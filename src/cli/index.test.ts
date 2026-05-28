import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../../../");

describe("CLI smoke test", () => {
  it("exits 0 and prints help", () => {
    const output = execSync(`node --import tsx/esm ${root}/src/cli/index.ts --help`, {
      encoding: "utf8",
    });
    expect(output).toContain("mcp-proj");
    expect(output).toContain("Declarative tool projections");
  });
});
