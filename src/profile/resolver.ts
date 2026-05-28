import { loadServerConfig } from "../server/config.js";
import { getEntry } from "../registry/store.js";
import { loadProjectionSet } from "../proxy/router.js";
import type { ProjectionSet } from "../proxy/router.js";
import type { ServerConfig } from "../server/config.js";
import type { ResolvedProfile } from "./loader.js";

export type ServerSlot = {
  config: ServerConfig;
  projectionSet: ProjectionSet;
};

export function resolveProfile(profile: ResolvedProfile): ServerSlot[] {
  return profile.servers.map((s) => ({
    config: resolveUpstream(s.upstream),
    projectionSet: loadProjectionSet(s.projections),
  }));
}

function resolveUpstream(upstream: string): ServerConfig {
  if (upstream.includes("/") || upstream.includes(".")) {
    return loadServerConfig(upstream);
  }
  const entry = getEntry(upstream);
  if (!entry) throw new Error(`Server '${upstream}' not found in registry`);
  return entry;
}
