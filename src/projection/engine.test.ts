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

import { callTool } from "../server/client.js";
const mockCallTool = vi.mocked(callTool);

beforeEach(() => {
  mockCallTool.mockReset();
  mockCallTool.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
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
  it("uses definition params as defaults", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 10 } };
    await runProjection(p, { b: 5 });
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 10, b: 5 });
  });

  it("caller params override definition params", async () => {
    const p: Projection = { ...base, kind: "partial", params: { a: 10, b: 1 } };
    await runProjection(p, { b: 99 });
    expect(mockCallTool).toHaveBeenCalledWith(expect.anything(), "echo", { a: 10, b: 99 });
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
