import { beforeEach, describe, expect, it, vi } from "vitest";
import { measureProfile } from "./measure.js";
import type { ResolvedProfile } from "./loader.js";

vi.mock("../server/client.js", () => ({
  listTools: vi.fn(),
}));

vi.mock("../registry/store.js", () => ({
  getEntry: (name: string) => ({ name, command: "unused", args: [] }),
}));

import { listTools } from "../server/client.js";
const mockListTools = vi.mocked(listTools);

describe("measureProfile", () => {
  beforeEach(() => {
    mockListTools.mockReset();
  });

  it("measures a live profile surface", async () => {
    mockListTools.mockResolvedValueOnce([
      { name: "read_file", inputSchema: { type: "object" } },
      { name: "delete_file", inputSchema: { type: "object" } },
    ]);

    const profile: ResolvedProfile = {
      name: "minimal",
      collision: "error",
      servers: [
        {
          upstream: "filesystem",
          projections: [
            {
              kind: "partial",
              name: "read-src",
              server: "filesystem",
              tool: "read_file",
              params: { root: "src" },
            },
            { kind: "absent", name: "no-delete", server: "filesystem", tool: "delete_file" },
          ],
        },
      ],
    };

    const measurement = await measureProfile(profile);

    expect(measurement.total_exposed_tools).toBe(1);
    expect(measurement.total_schema_bytes).toBeGreaterThan(0);
    expect(measurement.estimated_schema_tokens).toBeGreaterThan(0);
    expect(measurement.tools.map((tool) => tool.name)).toEqual(["read_file"]);
  });

  it("measures simulated and absent projections without a live server", async () => {
    const profile: ResolvedProfile = {
      name: "offline",
      collision: "error",
      servers: [
        {
          upstream: "not-installed",
          projections: [
            {
              kind: "simulated",
              name: "fake-search",
              server: "not-installed",
              tool: "search",
              response: [{ type: "text", text: "ok" }],
            },
            { kind: "absent", name: "hide-delete", server: "not-installed", tool: "delete" },
          ],
        },
      ],
    };

    const measurement = await measureProfile(profile);

    expect(mockListTools).not.toHaveBeenCalled();
    expect(measurement.total_exposed_tools).toBe(1);
    expect(measurement.tools[0].name).toBe("search");
  });
});
