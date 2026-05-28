import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Boots an in-process MCP server with two fake tools and returns a
// connected Client without spawning any subprocess.
async function makeTestPair(): Promise<{
  client: Client;
  server: Server;
  cleanup: () => Promise<void>;
}> {
  const server = new Server(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "echo",
        description: "Echoes its input",
        inputSchema: { type: "object", properties: { message: { type: "string" } } },
      },
      {
        name: "fail",
        description: "Always errors",
        inputSchema: { type: "object" },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "echo") {
      const msg = (req.params.arguments as Record<string, unknown>)?.message ?? "";
      return { content: [{ type: "text", text: String(msg) }] };
    }
    return { content: [{ type: "text", text: "forced error" }], isError: true };
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    server,
    cleanup: async () => {
      await client.close();
    },
  };
}

describe("listTools", () => {
  it("returns tool names and schemas", async () => {
    const { client, cleanup } = await makeTestPair();
    const result = await client.listTools();
    await cleanup();

    expect(result.tools.map((t) => t.name)).toEqual(["echo", "fail"]);
  });
});

describe("callTool", () => {
  it("returns content on success", async () => {
    const { client, cleanup } = await makeTestPair();
    const result = await client.callTool({ name: "echo", arguments: { message: "hello" } });
    await cleanup();

    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
    expect(result.isError).toBeFalsy();
  });

  it("returns isError true on tool error", async () => {
    const { client, cleanup } = await makeTestPair();
    const result = await client.callTool({ name: "fail", arguments: {} });
    await cleanup();

    expect(result.isError).toBe(true);
  });
});

describe("tool info shape", () => {
  it("maps SDK tool list to ToolInfo structure", async () => {
    const { client, cleanup } = await makeTestPair();
    const raw = await client.listTools();
    await cleanup();

    const mapped = raw.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as object,
    }));

    expect(mapped[0]).toMatchObject({ name: "echo", description: "Echoes its input" });
    expect(mapped[0].inputSchema).toBeDefined();
  });
});
