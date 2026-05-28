import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runParamResolver, runResultResolver } from "./runner.js";

function tmpScript(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mcp-resolver-test-"));
  const path = join(dir, "resolver.mjs");
  writeFileSync(path, content, "utf8");
  return path;
}

// ─── ParamResolver ────────────────────────────────────────────────────────────

describe("runParamResolver — inline-js", () => {
  it("transforms params with a sync arrow function", async () => {
    const result = await runParamResolver(
      {
        type: "inline-js",
        script: "({ user, ...rest }) => ({ ...rest, recipient: user + '@example.com' })",
      },
      { user: "alice", subject: "hello" },
    );
    expect(result).toEqual({ recipient: "alice@example.com", subject: "hello" });
  });

  it("transforms params with an async arrow function", async () => {
    const result = await runParamResolver(
      { type: "inline-js", script: "async (p) => ({ ...p, extra: 42 })" },
      { x: 1 },
    );
    expect(result).toEqual({ x: 1, extra: 42 });
  });

  it("throws when resolver returns an array instead of an object", async () => {
    await expect(runParamResolver({ type: "inline-js", script: "(p) => [p]" }, {})).rejects.toThrow(
      "plain object",
    );
  });
});

describe("runParamResolver — script-file", () => {
  it("runs an .mjs file and returns the transformed params", async () => {
    const path = tmpScript(
      `export default ({ count, ...rest }) => ({ ...rest, count: Number(count) * 2 });`,
    );
    const result = await runParamResolver({ type: "script-file", path }, { count: "5", q: "hi" });
    expect(result).toEqual({ count: 10, q: "hi" });
  });

  it("supports async default exports", async () => {
    const path = tmpScript(`export default async (p) => ({ resolved: true, ...p });`);
    const result = await runParamResolver({ type: "script-file", path }, { a: 1 });
    expect(result).toEqual({ resolved: true, a: 1 });
  });

  it("rejects when the script exits with an error", async () => {
    const path = tmpScript(`throw new Error("intentional failure");`);
    await expect(runParamResolver({ type: "script-file", path }, {})).rejects.toThrow(
      "exited with code",
    );
  });
});

// ─── ResultResolver ───────────────────────────────────────────────────────────

describe("runResultResolver — inline-js", () => {
  it("returns a content array from a sync function", async () => {
    const result = await runResultResolver(
      { type: "inline-js", script: "({ city }) => [{ type: 'text', text: `Sunny in ${city}` }]" },
      { city: "Paris" },
    );
    expect(result).toEqual([{ type: "text", text: "Sunny in Paris" }]);
  });

  it("returns a content array from an async function", async () => {
    const result = await runResultResolver(
      { type: "inline-js", script: "async (p) => [{ type: 'text', text: JSON.stringify(p) }]" },
      { x: 42 },
    );
    expect(result).toEqual([{ type: "text", text: '{"x":42}' }]);
  });

  it("throws when resolver returns an object instead of an array", async () => {
    await expect(
      runResultResolver({ type: "inline-js", script: "(p) => ({ not: 'an array' })" }, {}),
    ).rejects.toThrow("array");
  });
});

describe("runResultResolver — script-file", () => {
  it("runs an .mjs file and returns the content array", async () => {
    const path = tmpScript(
      `export default ({ city }) => [{ type: "text", text: \`Weather in \${city}: sunny\` }];`,
    );
    const result = await runResultResolver({ type: "script-file", path }, { city: "Tokyo" });
    expect(result).toEqual([{ type: "text", text: "Weather in Tokyo: sunny" }]);
  });
});
