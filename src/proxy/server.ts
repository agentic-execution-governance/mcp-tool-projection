import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ServerConfig } from "../server/config.js";
import { proxyListTools, proxyCallTool, applyProjectionToTool, type ProjectionSet } from "./router.js";
import { listTools } from "../server/client.js";
import { runProjection, AbsentToolError } from "../projection/engine.js";
import { callTool } from "../server/client.js";
import type { ToolInfo } from "../server/client.js";
import type { Projection } from "../projection/schema.js";
import type { CollisionStrategy } from "../profile/schema.js";
import type { ServerSlot } from "../profile/resolver.js";

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

  // Detect collisions
  const seen = new Map<string, string>(); // toolName -> serverName
  const conflicts = new Set<string>();
  for (const { toolName, entry } of candidates) {
    if (seen.has(toolName)) {
      conflicts.add(toolName);
    } else {
      seen.set(toolName, entry.upstream.name);
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
    // projectedName (if set) is the exposed name; collision prefix is prepended on top of it.
    const projectedBase = entry.projection?.projectedName ?? toolName;

    if (conflicts.has(toolName)) {
      if (collision === "first") {
        if (!firstSeen.has(toolName)) {
          firstSeen.add(toolName);
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
): Promise<Server> {
  const routingTable = await buildRoutingTable(slots, collision);

  const serverNames = slots.map((s) => s.config.name).join(",");
  const server = new Server(
    { name: `mcp-proj-profile:[${serverNames}]`, version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [...routingTable.entries()].map(([exposedName, route]) => {
      const applied = route.projection
        ? applyProjectionToTool(route.toolInfo, route.projection)
        : route.toolInfo;
      return { name: exposedName, description: applied.description, inputSchema: applied.inputSchema };
    });
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const route = routingTable.get(req.params.name);
    if (!route) {
      return {
        content: [{ type: "text", text: `Tool '${req.params.name}' not found` }],
        isError: true,
      };
    }
    try {
      const result = await routeCall(route, args);
      return { content: result.content as never[], isError: result.isError };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });

  return server;
}

export async function serveProfileStdio(
  slots: ServerSlot[],
  collision: CollisionStrategy,
): Promise<void> {
  const server = await createProfileProxyServer(slots, collision);
  await server.connect(new StdioServerTransport());
}

export async function serveProfileTransport(
  slots: ServerSlot[],
  collision: CollisionStrategy,
  transport: Transport,
): Promise<Server> {
  const server = await createProfileProxyServer(slots, collision);
  await server.connect(transport);
  return server;
}
