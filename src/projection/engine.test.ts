import { describe, it, expect, vi, beforeEach } from "vitest";
import { runProjection, AbsentToolError } from "./engine.js";
import type { Projection } from "./schema.js";

// Mock registry and client so tests don't touch disk or spawn processes.
vi.mock("../registry/store.js", () => ({
  getEntry: (name: string) =>
    name === "echo-server" ? { name: "echo-server", command: "unused", args: [] } : undefined,
}));

vi.mock("../server/client.js", () => ({
  callTool: vi.fn(),
}));

vi.mock("../resolvers/runner.js", () => ({
  runParamResolver: vi.fn(),
  runResultResolver: vi.fn(),
}));

import { callTool } from "../server/client.js";
import { runParamResolver, runResultResolver } from "../resolvers/runner.js";
const mockCallTool = vi.mocked(callTool);
const mockParamResolver = vi.mocked(runParamResolver);
const mockResultResolver = vi.mocked(runResultResolver);

beforeEach(() => {
  mockCallTool.mockReset();
  mockCallTool.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
  mockParamResolver.mockReset();
  mockResultResolver.mockReset();
});

const base = { name: "p", server: "echo-server", tool: "echo" };

describe("absent", () => {
  it("throws AbsentToolError without calling the server", async () => {
    const p: Projection = { ...base, kind: "absent" };
    await expect(runProjection(p)).rejects.toThrow(AbsentToolError);
    expect(mockCallTool).not.toHaveBeenCalled();
  });
});

describe("simulated", () => {
  it("returns the canned response without calling the server", async () => {
    const p: Projection = {
      ...base,
      kind: "simulated",
      response: [{ type: "text", text: "(simulated)" }],
    };
    const result = await runProjection(p);
    expect(result.content).toEqual([{ type: "text", text: "(simulated)" }]);
    expect(mockCallTool).not.toHaveBeenCalled();
  });
});

describe("verbatim", () => {
  it("passes caller params straight through", async () => {
    const p: Projection = { ...base, kind: "verbatim" };
    await runProjection(p, { message: "hello" });
    expect(mockCallTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: "echo-server" }),
      "echo",
      { message: "hello" },
    );
  });
});

describe("partial", () => {
  it("merges caller free params with fixed projection params", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 10 } };
    await runProjection(p, { b: 5 });
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 10, b: 5 });
  });

  it("projection params are fixed — caller cannot override them", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 10, b: 1 } };
    await runProjection(p, { b: 99 });
    // b is fixed at 1; caller's b: 99 is ignored
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 10, b: 1 });
  });

  it("works with no caller params", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 10, b: 3 } };
    await runProjection(p);
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 10, b: 3 });
  });
});

describe("registry miss", () => {
  it("throws when server is not in registry", async () => {
    const p: Projection = { ...base, server: "unknown-server", kind: "verbatim" };
    await expect(runProjection(p)).rejects.toThrow("not found in registry");
  });
});

describe("partial with paramResolver", () => {
  it("calls the resolver with caller params and uses its output", async () => {
    mockParamResolver.mockResolvedValue({ recipient: "alice@example.com" });
    const p: Projection = {
      ...base,
      kind: "partial",
      paramResolver: { type: "inline-js", script: "(p) => p" },
    };
    await runProjection(p, { user: "alice" });
    expect(mockParamResolver).toHaveBeenCalledWith(
      expect.objectContaining({ type: "inline-js" }),
      { user: "alice" },
    );
    expect(mockCallTool).toHaveBeenCalledWith(
      expect.anything(),
      "echo",
      { recipient: "alice@example.com" },
    );
  });

  it("falls back to static params merge when no resolver", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 1 } };
    await runProjection(p, { b: 2 });
    expect(mockParamResolver).not.toHaveBeenCalled();
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 1, b: 2 });
  });
});

describe("simulated with resultResolver", () => {
  it("calls the resolver and returns its content array", async () => {
    mockResultResolver.mockResolvedValue([{ type: "text", text: "dynamic" }]);
    const p: Projection = {
      ...base,
      kind: "simulated",
      resultResolver: { type: "inline-js", script: "(p) => []" },
    };
    const result = await runProjection(p, { city: "Paris" });
    expect(mockResultResolver).toHaveBeenCalledWith(
      expect.objectContaining({ type: "inline-js" }),
      { city: "Paris" },
    );
    expect(result.content).toEqual([{ type: "text", text: "dynamic" }]);
    expect(mockCallTool).not.toHaveBeenCalled();
  });

  it("falls back to static response when no resolver", async () => {
    const p: Projection = {
      ...base,
      kind: "simulated",
      response: [{ type: "text", text: "(static)" }],
    };
    const result = await runProjection(p);
    expect(mockResultResolver).not.toHaveBeenCalled();
    expect(result.content).toEqual([{ type: "text", text: "(static)" }]);
  });
});
