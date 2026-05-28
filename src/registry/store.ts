import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const RegistryEntrySchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  installedAt: z.string(),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

const RegistryFileSchema = z.record(z.string(), RegistryEntrySchema);

function registryPath(): string {
  return path.join(homedir(), ".mcp-projection", "registry.json");
}

function ensureDir(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readRegistry(): Record<string, RegistryEntry> {
  const p = registryPath();
  if (!existsSync(p)) return {};
  const raw = readFileSync(p, "utf8");
  return RegistryFileSchema.parse(JSON.parse(raw));
}

export function writeRegistry(entries: Record<string, RegistryEntry>): void {
  const p = registryPath();
  ensureDir(p);
  writeFileSync(p, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

export function getEntry(name: string): RegistryEntry | undefined {
  return readRegistry()[name];
}

export function addEntry(entry: Omit<RegistryEntry, "installedAt">): RegistryEntry {
  const registry = readRegistry();
  const full: RegistryEntry = { ...entry, installedAt: new Date().toISOString() };
  registry[entry.name] = full;
  writeRegistry(registry);
  return full;
}

export function removeEntry(name: string): boolean {
  const registry = readRegistry();
  if (!(name in registry)) return false;
  delete registry[name];
  writeRegistry(registry);
  return true;
}
