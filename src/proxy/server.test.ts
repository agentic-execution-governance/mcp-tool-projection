import { describe, it, expect, vi, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createProxyServer, loadProjectionSet } from "./index.js";
import type { Projection } from "../projection/schema.js";
import type { ServerConfig } from "../server/config.js";

// The proxy calls listTools/callTool which use StdioClientTransport internally.
// We replace them with an in-process upstream so no subprocess is spawned.
vi.mock("../server/client.js", () => ({
  listTools: vi.fn(),
  callTool: vi.fn(),
  withMcpClient: vi.fn(),
}));

vi.mock("../registry/store.js", () => ({
  getEntry: (name: string) =>
    name === "fake" ? { name: "fake", command: "unused", args: [] } : undefined,
}));

import { listTools, callTool } from "../server/client.js";
const mockList = vi.mocked(listTools);
const mockCall = vi.mocked(callTool);

const upstreamConfig: ServerConfig = { name: "fake", command: "unused", args: [] };

const upstreamTools = [
  {
    name: "echo",
    description: "Echoes input",
    inputSchema: { type: "object", properties: { message: { type: "string" } } },
  },
  {
    name: "add",
    description: "Adds two numbers",
    inputSchema: { type: "object" },
  },
  {
    name: "secret",
    description: "Should be hidden",
    inputSchema: { type: "object" },
  },
];

beforeAll(() => {
  mockList.mockResolvedValue(upstreamTools);
  mockCall.mockImplementation(async (_cfg, tool, params) => {
    if (tool === "echo")
      return { content: [{ type: "text", text: (params as Record<string, unknown>).message }] };
    if (tool === "add") {
      const p = params as Record<string, unknown>;
      return { content: [{ type: "text", text: String(Number(p.a) + Number(p.b)) }] };
    }
    return { content: [{ type: "text", text: "unknown" }], isError: true };
  });
});

async function makeProxyClient(projections: Projection[]): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const projectionSet = loadProjectionSet(projections);
  const proxyServer = await createProxyServer(upstreamConfig, projectionSet);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  // The proxy server is already constructed; connect it to the server-side transport.
  // We have to reach into the server to connect it to a new transport.
  const rawServer = proxyServer as unknown as Server;
  await Promise.all([rawServer.connect(serverTransport), client.connect(clientTransport)]);

  return { client, cleanup: () => client.close() };
}

describe("proxy tools/list", () => {
  it("returns all upstream tools when no projections are set", async () => {
    const { client, cleanup } = await makeProxyClient([]);
    const result = await client.listTools();
    await cleanup();
    expect(result.tools.map((t) => t.name)).toEqual(["echo", "add", "secret"]);
  });

  it("hides absent tools", async () => {
    const projections: Projection[] = [
      { name: "hide-secret", kind: "absent", server: "fake", tool: "secret" },
    ];
    const { client, cleanup } = await makeProxyClient(projections);
    const result = await client.listTools();
    await cleanup();
    expect(result.tools.map((t) => t.name)).not.toContain("secret");
    expect(result.tools.map((t) => t.name)).toContain("echo");
  });
});

describe("proxy tools/call", () => {
  it("passes verbatim calls straight to upstream", async () => {
    const projections: Projection[] = [
      { name: "echo-verbatim", kind: "verbatim", server: "fake", tool: "echo" },
    ];
    const { client, cleanup } = await makeProxyClient(projections);
    const result = await client.callTool({ name: "echo", arguments: { message: "hi" } });
    await cleanup();
    expect((result.content[0] as { text: string }).text).toBe("hi");
  });

  it("merges partial params with caller params", async () => {
    const projections: Projection[] = [
      { name: "add-partial", kind: "partial", server: "fake", tool: "add", params: { a: 10 } },
    ];
    const { client, cleanup } = await makeProxyClient(projections);
    await client.callTool({ name: "add", arguments: { b: 5 } });
    await cleanup();
    expect(mockCall).toHaveBeenCalledWith(
      expect.anything(),
      "add",
      expect.objectContaining({ a: 10, b: 5 }),
    );
  });

  it("returns simulated response without calling upstream", async () => {
    mockCall.mockClear();
    const projections: Projection[] = [
      {
        name: "echo-sim",
        kind: "simulated",
        server: "fake",
        tool: "echo",
        response: [{ type: "text", text: "(mocked)" }],
      },
    ];
    const { client, cleanup } = await makeProxyClient(projections);
    const result = await client.callTool({ name: "echo", arguments: {} });
    await cleanup();
    expect((result.content[0] as { text: string }).text).toBe("(mocked)");
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("returns isError for absent tool calls", async () => {
    const projections: Projection[] = [
      { name: "hide-secret", kind: "absent", server: "fake", tool: "secret" },
    ];
    const { client, cleanup } = await makeProxyClient(projections);
    const result = await client.callTool({ name: "secret", arguments: {} });
    await cleanup();
    expect(result.isError).toBe(true);
  });

  it("falls through to upstream for unmatched tools", async () => {
    const { client, cleanup } = await makeProxyClient([]);
    const result = await client.callTool({ name: "add", arguments: { a: 3, b: 4 } });
    await cleanup();
    expect((result.content[0] as { text: string }).text).toBe("7");
  });
});
