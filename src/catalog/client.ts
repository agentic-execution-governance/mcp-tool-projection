import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { CatalogSchema, type Catalog, type CatalogEntry } from "./schema.js";

const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/agentic-execution-governance/mcp-tool-projection/dev/catalog.json";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cachePath(): string {
  return path.join(homedir(), ".mcp-projection", "catalog-cache.json");
}

type CachedCatalog = { fetchedAt: number; catalog: Catalog };

function readCache(): CachedCatalog | null {
  const p = cachePath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CachedCatalog;
  } catch {
    return null;
  }
}

function writeCache(catalog: Catalog): void {
  const p = cachePath();
  mkdirSync(path.dirname(p), { recursive: true });
  const payload: CachedCatalog = { fetchedAt: Date.now(), catalog };
  writeFileSync(p, JSON.stringify(payload, null, 2), "utf8");
}

export async function fetchCatalog(url = DEFAULT_CATALOG_URL, forceRefresh = false): Promise<Catalog> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.catalog;
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch catalog from ${url}: ${res.status} ${res.statusText}`);
  const raw = await res.json();
  const catalog = CatalogSchema.parse(raw);
  writeCache(catalog);
  return catalog;
}

export function searchCatalog(catalog: Catalog, query: string): CatalogEntry[] {
  const q = query.toLowerCase();
  return catalog.servers.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function getCatalogEntry(catalog: Catalog, name: string): CatalogEntry | undefined {
  return catalog.servers.find((s) => s.name === name);
}
