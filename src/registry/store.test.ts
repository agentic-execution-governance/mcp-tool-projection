import { describe, it, expect, beforeEach, vi } from "vitest";

// Must be declared before importing the module under test so vitest hoists it.
vi.mock("node:os", () => ({ homedir: () => "/tmp/mcp-proj-test" }));

import { readRegistry, writeRegistry, addEntry, removeEntry, getEntry } from "./store.js";

beforeEach(() => {
  writeRegistry({});
});

describe("addEntry", () => {
  it("persists an entry and sets installedAt", () => {
    const entry = addEntry({ name: "test-server", command: "node", args: ["server.js"] });
    expect(entry.name).toBe("test-server");
    expect(entry.installedAt).toBeTruthy();
    expect(readRegistry()["test-server"]).toMatchObject({ name: "test-server" });
  });

  it("overwrites an existing entry with the same name", () => {
    addEntry({ name: "srv", command: "old", args: [] });
    addEntry({ name: "srv", command: "new", args: [] });
    expect(readRegistry()["srv"].command).toBe("new");
  });
});

describe("removeEntry", () => {
  it("returns true and deletes the entry", () => {
    addEntry({ name: "to-remove", command: "x", args: [] });
    expect(removeEntry("to-remove")).toBe(true);
    expect(readRegistry()["to-remove"]).toBeUndefined();
  });

  it("returns false when entry does not exist", () => {
    expect(removeEntry("ghost")).toBe(false);
  });
});

describe("getEntry", () => {
  it("returns the entry if it exists", () => {
    addEntry({ name: "found", command: "cmd", args: ["a"] });
    expect(getEntry("found")).toMatchObject({ name: "found", command: "cmd" });
  });

  it("returns undefined for unknown names", () => {
    expect(getEntry("missing")).toBeUndefined();
  });
});
