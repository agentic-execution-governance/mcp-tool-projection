import { readFileSync, readdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import yaml from "js-yaml";
import { ProjectionSchema, type Projection } from "./schema.js";

export function loadProjection(filePath: string): Projection {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, "utf8");
  const parsed = abs.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
  return ProjectionSchema.parse(parsed);
}

export function listProjections(dir: string): Projection[] {
  const abs = resolve(dir);
  return readdirSync(abs)
    .filter((f) => [".json", ".yaml", ".yml"].includes(extname(f)))
    .map((f) => loadProjection(resolve(abs, f)));
}
