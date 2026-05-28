import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import yaml from "js-yaml";
import { ProfileSchema, type ProjectionEntry, type CollisionStrategy } from "./schema.js";
import { loadProjection } from "../projection/loader.js";
import { ProjectionSchema, type Projection } from "../projection/schema.js";

export type ResolvedProfileServer = {
  upstream: string;
  projections: Projection[];
};

export type ResolvedProfile = {
  name: string;
  description?: string;
  collision: CollisionStrategy;
  servers: ResolvedProfileServer[];
};

export function loadProfile(filePath: string): ResolvedProfile {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, "utf8");
  const parsed = abs.endsWith(".json") ? JSON.parse(raw) : (yaml.load(raw) as unknown);
  const profile = ProfileSchema.parse(parsed);
  const baseDir = dirname(abs);

  return {
    name: profile.name,
    description: profile.description,
    collision: profile.collision,
    servers: profile.servers.map((entry) => ({
      upstream: entry.upstream,
      projections: entry.projections.map((pe) => resolveEntry(pe, entry.upstream, baseDir)),
    })),
  };
}

function resolveEntry(entry: ProjectionEntry, server: string, baseDir: string): Projection {
  if ("file" in entry) {
    return loadProjection(resolve(baseDir, entry.file));
  }
  // Inline: attach the server name inherited from the enclosing profile server entry
  return ProjectionSchema.parse({ ...entry, server });
}
