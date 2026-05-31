import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadProfile } from "./loader.js";
import { measureProfile } from "./measure.js";

const root = path.resolve(fileURLToPath(import.meta.url), "../../../");

describe("measureProfile integration", () => {
  it("measures the canonical minimal-4 demo profile", async () => {
    const profile = loadProfile(path.join(root, "profiles/minimal-4.yaml"));
    const measurement = await measureProfile(profile);

    expect(measurement.profile).toBe("minimal-4");
    expect(measurement.total_exposed_tools).toBe(4);
    expect(measurement.total_schema_bytes).toBeGreaterThan(0);
    expect(measurement.estimated_schema_tokens).toBeGreaterThan(0);
  }, 15_000);
});
