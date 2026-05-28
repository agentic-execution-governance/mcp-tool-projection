import { z } from "zod";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

export const ServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadServerConfig(filePath: string): ServerConfig {
  const raw = readFileSync(filePath, "utf8");
  const parsed = filePath.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
  return ServerConfigSchema.parse(parsed);
}
