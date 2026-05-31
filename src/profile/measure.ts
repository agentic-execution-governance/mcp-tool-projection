import { loadServerConfig, type ServerConfig } from "../server/config.js";
import { listTools, type ToolInfo } from "../server/client.js";
import { getEntry } from "../registry/store.js";
import { applyProjectionToTool } from "../proxy/router.js";
import type { CollisionStrategy } from "./schema.js";
import type { ResolvedProfile, ResolvedProfileServer } from "./loader.js";
import type { Projection } from "../projection/schema.js";
import { byteLength, estimateToolSchemaTokens, toolSchemaBytes } from "../trace/tokenEstimator.js";
import type { ToolsListEvent } from "../trace/schema.js";

export type ProfileMeasurement = {
  profile: string;
  total_exposed_tools: number;
  total_schema_bytes: number;
  estimated_schema_tokens: number;
  result_bytes: number;
  latency_ms: number;
  tools: ToolInfo[];
};

type CollectedTool = {
  upstreamName: string;
  exposedName: string;
  tool: ToolInfo;
};

export async function measureProfile(profile: ResolvedProfile): Promise<ProfileMeasurement> {
  const started = Date.now();
  const collected: CollectedTool[] = [];

  for (const server of profile.servers) {
    collected.push(...(await collectServerTools(server)));
  }

  const tools = applyCollisionStrategy(collected, profile.collision);
  const payload = { tools };

  return {
    profile: profile.name,
    total_exposed_tools: tools.length,
    total_schema_bytes: toolSchemaBytes(tools),
    estimated_schema_tokens: estimateToolSchemaTokens(tools),
    result_bytes: byteLength(payload),
    latency_ms: Date.now() - started,
    tools,
  };
}

export function measurementToTraceEvent(measurement: ProfileMeasurement): ToolsListEvent {
  return {
    timestamp: new Date().toISOString(),
    event_type: "tools_list",
    profile: measurement.profile,
    latency_ms: measurement.latency_ms,
    total_tools: measurement.total_exposed_tools,
    schema_bytes: measurement.total_schema_bytes,
    estimated_schema_tokens: measurement.estimated_schema_tokens,
    result_bytes: measurement.result_bytes,
  };
}

async function collectServerTools(server: ResolvedProfileServer): Promise<CollectedTool[]> {
  const upstreamName = upstreamLabel(server.upstream);
  const liveRequired =
    server.projections.length === 0 ||
    server.projections.some(
      (projection) => projection.kind === "verbatim" || projection.kind === "partial",
    );

  if (!liveRequired) {
    return server.projections
      .filter((projection) => projection.kind === "simulated")
      .map((projection) => ({
        upstreamName,
        exposedName: projection.projectedName ?? projection.tool,
        tool: simulatedToolInfo(projection),
      }));
  }

  const config = resolveUpstream(server.upstream);
  const upstreamTools = await listTools(config);
  const projectionsByTool = new Map(
    server.projections.map((projection) => [projection.tool, projection]),
  );

  return upstreamTools
    .filter((tool) => projectionsByTool.get(tool.name)?.kind !== "absent")
    .map((tool) => {
      const projection = projectionsByTool.get(tool.name);
      const applied = projection ? applyProjectionToTool(tool, projection) : tool;
      return {
        upstreamName: config.name,
        exposedName: applied.name,
        tool: applied,
      };
    });
}

function applyCollisionStrategy(
  collected: CollectedTool[],
  collision: CollisionStrategy,
): ToolInfo[] {
  const counts = new Map<string, number>();
  for (const item of collected) {
    counts.set(item.exposedName, (counts.get(item.exposedName) ?? 0) + 1);
  }
  const conflicts = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );

  if (conflicts.size > 0 && collision === "error") {
    throw new Error(
      `Tool name collision across servers: ${[...conflicts].join(", ")}. ` +
        "Set collision: prefix|first in your profile to resolve.",
    );
  }

  const firstSeen = new Set<string>();
  const tools: ToolInfo[] = [];

  for (const item of collected) {
    if (!conflicts.has(item.exposedName)) {
      tools.push(item.tool);
      continue;
    }

    if (collision === "first") {
      if (firstSeen.has(item.exposedName)) continue;
      firstSeen.add(item.exposedName);
      tools.push(item.tool);
      continue;
    }

    tools.push({
      ...item.tool,
      name: `${item.upstreamName}__${item.exposedName}`,
    });
  }

  return tools;
}

function simulatedToolInfo(projection: Projection): ToolInfo {
  return {
    name: projection.projectedName ?? projection.tool,
    description: projection.description,
    inputSchema: {
      type: "object",
      additionalProperties: true,
    },
  };
}

function resolveUpstream(upstream: string): ServerConfig {
  if (upstream.includes("/") || upstream.includes(".")) {
    return loadServerConfig(upstream);
  }
  const entry = getEntry(upstream);
  if (!entry) throw new Error(`Server '${upstream}' not found in registry`);
  return entry;
}

function upstreamLabel(upstream: string): string {
  if (!upstream.includes("/") && !upstream.includes(".")) return upstream;

  try {
    return loadServerConfig(upstream).name;
  } catch {
    return upstream.replace(/[^A-Za-z0-9_-]+/g, "_");
  }
}
