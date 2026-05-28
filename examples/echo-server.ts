#!/usr/bin/env tsx
/**
 * Minimal MCP server for Phase 1 demo.
 * Exposes two tools: echo and add.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "echo-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "echo",
      description: "Returns the message unchanged",
      inputSchema: {
        type: "object",
        properties: { message: { type: "string", description: "Text to echo" } },
        required: ["message"],
      },
    },
    {
      name: "add",
      description: "Adds two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = req.params.arguments as Record<string, unknown>;

  if (req.params.name === "echo") {
    return { content: [{ type: "text", text: String(args.message ?? "") }] };
  }

  if (req.params.name === "add") {
    const result = Number(args.a) + Number(args.b);
    return { content: [{ type: "text", text: String(result) }] };
  }

  return { content: [{ type: "text", text: "unknown tool" }], isError: true };
});

await server.connect(new StdioServerTransport());
