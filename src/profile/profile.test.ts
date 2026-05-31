import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadProfile } from "./loader.js";
import { resolveProfile } from "./resolver.js";
import { createProfileProxyServer } from "../proxy/server.js";
import { loadProjectionSet } from "../proxy/router.js";
import type { ServerSlot } from "./resolver.js";
import type { Projection } from "../projection/schema.js";
import type { ServerConfig } from "../server/config.js";
import type { ProfileTraceOptions } from "../proxy/server.js";

// ─── mocks ────────────────────────────────────────────────────────────────────

vi.mock("../server/client.js", () => ({
  listTools: vi.fn(),
  callTool: vi.fn(),
  withMcpClient: vi.fn(),
}));

vi.mock("../registry/store.js", () => ({
  getEntry: (name: string) => {
    if (name === "server-a" || name === "server-b") {
      return { name, command: "unused", args: [] };
    }
    return undefined;
  },
}));

import { listTools, callTool } from "../server/client.js";
const mockList = vi.mocked(listTools);
const mockCall = vi.mocked(callTool);

// ─── helpers ──────────────────────────────────────────────────────────────────

function writeTmp(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mcp-proj-test-"));
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

async function makeProfileClient(
  slots: ServerSlot[],
  collision: "error" | "prefix" | "first" = "error",
  traceOptions?: ProfileTraceOptions,
) {
  const proxyServer = await createProfileProxyServer(slots, collision, traceOptions);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([
    (proxyServer as unknown as import("@modelcontextprotocol/sdk/server/index.js").Server).connect(
      serverTransport,
    ),
    client.connect(clientTransport),
  ]);
  return { client, cleanup: () => client.close() };
}

function slot(name: string, projections: Projection[] = []): ServerSlot {
  return {
    config: { name, command: "unused", args: [] } as ServerConfig,
    projectionSet: loadProjectionSet(projections),
  };
}

// ─── loader tests ─────────────────────────────────────────────────────────────

describe("loadProfile", () => {
  it("parses a valid inline-only profile", () => {
    const yaml = `
name: test-profile
collision: error
servers:
  - upstream: server-a
    projections:
      - kind: absent
        name: hide-secret
        tool: secret
`;
    const path = writeTmp("profile.yaml", yaml);
    const profile = loadProfile(path);
    expect(profile.name).toBe("test-profile");
    expect(profile.servers).toHaveLength(1);
    expect(profile.servers[0].projections).toHaveLength(1);
    expect(profile.servers[0].projections[0]).toMatchObject({
      kind: "absent",
      name: "hide-secret",
      tool: "secret",
      server: "server-a",
    });
  });

  it("resolves a file-referenced projection", () => {
    const projYaml = `
name: hide-secret
kind: absent
server: server-a
tool: secret
`;
    const dir = mkdtempSync(join(tmpdir(), "mcp-proj-test-"));
    const projPath = join(dir, "hide-secret.yaml");
    writeFileSync(projPath, projYaml, "utf8");

    const profileYaml = `
name: ref-profile
collision: error
servers:
  - upstream: server-a
    projections:
      - file: ${projPath}
`;
    const profilePath = join(dir, "profile.yaml");
    writeFileSync(profilePath, profileYaml, "utf8");

    const profile = loadProfile(profilePath);
    expect(profile.servers[0].projections[0]).toMatchObject({
      kind: "absent",
      name: "hide-secret",
      server: "server-a",
    });
  });

  it("throws for an invalid profile (missing name)", () => {
    const yaml = `
collision: error
servers:
  - upstream: server-a
`;
    const path = writeTmp("bad-profile.yaml", yaml);
    expect(() => loadProfile(path)).toThrow();
  });
});

// ─── resolver tests ───────────────────────────────────────────────────────────

describe("resolveProfile", () => {
  it("resolves known registry names to configs", () => {
    const profile = {
      name: "p",
      collision: "error" as const,
      servers: [{ upstream: "server-a", projections: [] }],
    };
    const slots = resolveProfile(profile);
    expect(slots).toHaveLength(1);
    expect(slots[0].config.name).toBe("server-a");
  });

  it("throws for an unknown registry name", () => {
    const profile = {
      name: "p",
      collision: "error" as const,
      servers: [{ upstream: "nonexistent-server", projections: [] }],
    };
    expect(() => resolveProfile(profile)).toThrow("not found in registry");
  });
});

// ─── profile proxy tests ──────────────────────────────────────────────────────

const toolsA = [
  { name: "echo", description: "Echoes", inputSchema: { type: "object" } },
  { name: "secret", description: "Hidden", inputSchema: { type: "object" } },
];
const toolsB = [
  { name: "add", description: "Adds", inputSchema: { type: "object" } },
  { name: "echo", description: "Also echoes", inputSchema: { type: "object" } }, // collision with server-a
];

beforeAll(() => {
  mockCall.mockImplementation(async (_cfg, tool, params) => {
    if (tool === "echo")
      return { content: [{ type: "text", text: (params as Record<string, unknown>).message }] };
    if (tool === "add") {
      const p = params as Record<string, unknown>;
      return { content: [{ type: "text", text: String(Number(p.a) + Number(p.b)) }] };
    }
    return { content: [{ type: "text", text: "ok" }] };
  });
});

describe("createProfileProxyServer — single server", () => {
  beforeAll(() => {
    mockList.mockResolvedValue(toolsA);
  });

  it("hides absent tools", async () => {
    const projections: Projection[] = [
      { name: "hide-secret", kind: "absent", server: "server-a", tool: "secret" },
    ];
    const { client, cleanup } = await makeProfileClient([slot("server-a", projections)]);
    const result = await client.listTools();
    await cleanup();
    expect(result.tools.map((t) => t.name)).not.toContain("secret");
    expect(result.tools.map((t) => t.name)).toContain("echo");
  });

  it("merges partial params on call", async () => {
    const projections: Projection[] = [
      {
        name: "echo-partial",
        kind: "partial",
        server: "server-a",
        tool: "echo",
        params: { prefix: "hi" },
      },
    ];
    const { client, cleanup } = await makeProfileClient([slot("server-a", projections)]);
    await client.callTool({ name: "echo", arguments: { message: "there" } });
    await cleanup();
    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "server-a" }),
      "echo",
      expect.objectContaining({ prefix: "hi", message: "there" }),
    );
  });

  it("writes live trace events for tools/list and tools/call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-proj-trace-test-"));
    const tracePath = join(dir, "trace.jsonl");
    const { client, cleanup } = await makeProfileClient([slot("server-a")], "error", {
      profileName: "trace-test",
      tracePath,
    });

    await client.listTools();
    await client.callTool({ name: "echo", arguments: { message: "hello" } });
    await cleanup();

    const events = readFileSync(tracePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      event_type: "tools_list",
      profile: "trace-test",
      total_tools: 2,
    });
    expect(events[1]).toMatchObject({
      event_type: "tools_call",
      profile: "trace-test",
      tool_name: "echo",
    });
    expect(events[1].result_bytes).toEqual(expect.any(Number));
    expect(events[1].estimated_result_tokens).toEqual(expect.any(Number));
  });
});

describe("createProfileProxyServer — collision strategies", () => {
  beforeAll(() => {
    mockList.mockImplementation(async (cfg) => {
      return cfg.name === "server-a" ? toolsA : toolsB;
    });
  });

  it("collision=error throws at startup", async () => {
    await expect(makeProfileClient([slot("server-a"), slot("server-b")], "error")).rejects.toThrow(
      "collision",
    );
  });

  it("collision=first keeps the first server's tool", async () => {
    const { client, cleanup } = await makeProfileClient(
      [slot("server-a"), slot("server-b")],
      "first",
    );
    const result = await client.listTools();
    await cleanup();
    const names = result.tools.map((t) => t.name);
    expect(names.filter((n) => n === "echo")).toHaveLength(1);
    expect(names).toContain("add");
  });

  it("collision=prefix exposes both tools with server prefix", async () => {
    const { client, cleanup } = await makeProfileClient(
      [slot("server-a"), slot("server-b")],
      "prefix",
    );
    const result = await client.listTools();
    await cleanup();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("server-a__echo");
    expect(names).toContain("server-b__echo");
    expect(names).toContain("add");
    expect(names).toContain("secret");
    expect(names).not.toContain("echo");
  });

  it("routes a prefixed call to the correct upstream", async () => {
    mockCall.mockClear();
    const { client, cleanup } = await makeProfileClient(
      [slot("server-a"), slot("server-b")],
      "prefix",
    );
    await client.callTool({ name: "server-b__echo", arguments: { message: "hello" } });
    await cleanup();
    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "server-b" }),
      "echo",
      expect.objectContaining({ message: "hello" }),
    );
  });
});
