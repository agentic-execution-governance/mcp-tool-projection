import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ServerConfig } from "../server/config.js";
import {
  proxyListTools,
  proxyCallTool,
  applyProjectionToTool,
  type ProjectionSet,
} from "./router.js";
import { listTools } from "../server/client.js";
import { runProjection, AbsentToolError } from "../projection/engine.js";
import { callTool } from "../server/client.js";
import type { ToolInfo } from "../server/client.js";
import type { Projection } from "../projection/schema.js";
import type { CollisionStrategy } from "../profile/schema.js";
import type { ServerSlot } from "../profile/resolver.js";
import { appendTraceEvent } from "../trace/writer.js";
import {
  byteLength,
  estimateTokens,
  estimateToolSchemaTokens,
  toolSchemaBytes,
} from "../trace/tokenEstimator.js";

export type ProfileTraceOptions = {
  profileName: string | null;
  tracePath?: string;
};

export async function createProxyServer(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
): Promise<Server> {
  const server = new Server(
    { name: `mcp-proj-proxy:${upstream.name}`, version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await proxyListTools(upstream, projectionSet);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await proxyCallTool(upstream, projectionSet, req.params.name, args);
      return { content: result.content as never[], isError: result.isError };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });

  return server;
}

export async function serveStdio(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
): Promise<void> {
  const server = await createProxyServer(upstream, projectionSet);
  await server.connect(new StdioServerTransport());
}

export async function serveTransport(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
  transport: Transport,
): Promise<Server> {
  const server = await createProxyServer(upstream, projectionSet);
  await server.connect(transport);
  return server;
}

// --- Profile (multi-server) proxy ---

type RouteEntry = {
  upstream: ServerConfig;
  projection: Projection | undefined;
  originalName: string;
  toolInfo: ToolInfo;
};

async function buildRoutingTable(
  slots: ServerSlot[],
  collision: CollisionStrategy,
): Promise<Map<string, RouteEntry>> {
  type Candidate = { toolName: string; entry: RouteEntry };
  const candidates: Candidate[] = [];

  for (const slot of slots) {
    const tools = await listTools(slot.config);
    for (const tool of tools) {
      const proj = slot.projectionSet.get(tool.name);
      if (proj?.kind === "absent") continue;
      candidates.push({
        toolName: tool.name,
        entry: {
          upstream: slot.config,
          projection: proj,
          originalName: tool.name,
          toolInfo: tool,
        },
      });
    }
  }

  // Collision detection uses the effective exposed name (projectedName ?? toolName),
  // not the original upstream name — a rename eliminates the conflict.
  const seen = new Map<string, string>(); // exposedName -> serverName
  const conflicts = new Set<string>();
  for (const { toolName, entry } of candidates) {
    const exposedName = entry.projection?.projectedName ?? toolName;
    if (seen.has(exposedName)) {
      conflicts.add(exposedName);
    } else {
      seen.set(exposedName, entry.upstream.name);
    }
  }

  if (conflicts.size > 0 && collision === "error") {
    throw new Error(
      `Tool name collision across servers: ${[...conflicts].join(", ")}. ` +
        `Set collision: prefix|first in your profile to resolve.`,
    );
  }

  const table = new Map<string, RouteEntry>();
  const firstSeen = new Set<string>();

  for (const { toolName, entry } of candidates) {
    const projectedBase = entry.projection?.projectedName ?? toolName;

    if (conflicts.has(projectedBase)) {
      if (collision === "first") {
        if (!firstSeen.has(projectedBase)) {
          firstSeen.add(projectedBase);
          table.set(projectedBase, entry);
        }
      } else {
        // prefix
        const prefixedName = `${entry.upstream.name}__${projectedBase}`;
        table.set(prefixedName, entry);
      }
    } else {
      table.set(projectedBase, entry);
    }
  }

  return table;
}

async function routeCall(route: RouteEntry, callerParams: Record<string, unknown>) {
  const { upstream, projection, originalName } = route;
  if (projection) {
    if (projection.kind === "absent") throw new AbsentToolError(projection.name, originalName);
    return runProjection(projection, callerParams, upstream);
  }
  return callTool(upstream, originalName, callerParams);
}

export async function createProfileProxyServer(
  slots: ServerSlot[],
  collision: CollisionStrategy,
  traceOptions?: ProfileTraceOptions,
): Promise<Server> {
  const routingTable = await buildRoutingTable(slots, collision);

  const serverNames = slots.map((s) => s.config.name).join(",");
  const server = new Server(
    { name: `mcp-proj-profile:[${serverNames}]`, version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const started = Date.now();
    const tools = exposedTools(routingTable);
    if (traceOptions?.tracePath) {
      appendTraceEvent(traceOptions.tracePath, {
        timestamp: new Date().toISOString(),
        event_type: "tools_list",
        profile: traceOptions.profileName,
        latency_ms: Date.now() - started,
        total_tools: tools.length,
        schema_bytes: toolSchemaBytes(tools),
        estimated_schema_tokens: estimateToolSchemaTokens(tools),
        result_bytes: byteLength({ tools }),
      });
    }
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const started = Date.now();
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const route = routingTable.get(req.params.name);
    if (!route) {
      const result = {
        content: [{ type: "text", text: `Tool '${req.params.name}' not found` }],
        isError: true,
      };
      traceToolCall(traceOptions, req.params.name, undefined, result.content, Date.now() - started);
      return result;
    }
    try {
      const result = await routeCall(route, args);
      traceToolCall(
        traceOptions,
        req.params.name,
        exposedTool(req.params.name, route),
        result.content,
        Date.now() - started,
      );
      return { content: result.content as never[], isError: result.isError };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const content = [{ type: "text", text: msg }];
      traceToolCall(
        traceOptions,
        req.params.name,
        exposedTool(req.params.name, route),
        content,
        Date.now() - started,
      );
      return { content, isError: true };
    }
  });

  return server;
}

export async function serveProfileStdio(
  slots: ServerSlot[],
  collision: CollisionStrategy,
  traceOptions?: ProfileTraceOptions,
): Promise<void> {
  const server = await createProfileProxyServer(slots, collision, traceOptions);
  await server.connect(new StdioServerTransport());
}

export async function serveProfileTransport(
  slots: ServerSlot[],
  collision: CollisionStrategy,
  transport: Transport,
  traceOptions?: ProfileTraceOptions,
): Promise<Server> {
  const server = await createProfileProxyServer(slots, collision, traceOptions);
  await server.connect(transport);
  return server;
}

function exposedTools(routingTable: Map<string, RouteEntry>): ToolInfo[] {
  return [...routingTable.entries()].map(([exposedName, route]) => exposedTool(exposedName, route));
}

function exposedTool(exposedName: string, route: RouteEntry): ToolInfo {
  const applied = route.projection
    ? applyProjectionToTool(route.toolInfo, route.projection)
    : route.toolInfo;
  return {
    name: exposedName,
    description: applied.description,
    inputSchema: applied.inputSchema,
  };
}

function traceToolCall(
  traceOptions: ProfileTraceOptions | undefined,
  toolName: string,
  tool: ToolInfo | undefined,
  content: unknown[],
  latencyMs: number,
): void {
  if (!traceOptions?.tracePath) return;

  appendTraceEvent(traceOptions.tracePath, {
    timestamp: new Date().toISOString(),
    event_type: "tools_call",
    profile: traceOptions.profileName,
    tool_name: toolName,
    latency_ms: latencyMs,
    schema_bytes: tool ? byteLength(tool) : 0,
    estimated_schema_tokens: tool ? estimateTokens(tool) : 0,
    result_bytes: byteLength(content),
    estimated_result_tokens: estimateTokens(content),
  });
}
