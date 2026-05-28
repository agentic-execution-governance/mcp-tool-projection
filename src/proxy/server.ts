import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ServerConfig } from "../server/config.js";
import { proxyListTools, proxyCallTool, type ProjectionSet } from "./router.js";

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
