import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ParamResolver, ResultResolver } from "./types.js";

// ─── public API ───────────────────────────────────────────────────────────────

export async function runParamResolver(
  resolver: ParamResolver,
  callerParams: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await run(resolver, callerParams);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(
      `paramResolver must return a plain object, got: ${JSON.stringify(result)}`,
    );
  }
  return result as Record<string, unknown>;
}

export async function runResultResolver(
  resolver: ResultResolver,
  callerParams: Record<string, unknown>,
): Promise<unknown[]> {
  const result = await run(resolver, callerParams);
  if (!Array.isArray(result)) {
    throw new Error(
      `resultResolver must return an array, got: ${JSON.stringify(result)}`,
    );
  }
  return result;
}

// ─── dispatch ─────────────────────────────────────────────────────────────────

async function run(
  resolver: ParamResolver | ResultResolver,
  params: Record<string, unknown>,
): Promise<unknown> {
  return resolver.type === "inline-js"
    ? runInlineJs(resolver.script, params)
    : runScriptFile(resolver.path, params);
}

// ─── inline-js ────────────────────────────────────────────────────────────────

// Trust model: inline-js evaluates in the current process with full Node.js access
// (including `process`, file system, network). Only use projections from sources
// you control — treat inline-js the same as arbitrary code execution.
async function runInlineJs(
  script: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const fn = new Function(`return (${script.trim()})`)() as (
    p: Record<string, unknown>,
  ) => unknown;
  return Promise.resolve(fn(params));
}

// ─── script-file ──────────────────────────────────────────────────────────────

// script-file runs the resolver in an isolated child process for process-level
// isolation. The script must be a .mjs file that default-exports a function with
// the signature: (params: object) => object | Promise<object>
// Params are passed via the __MCP_RESOLVER_PARAMS environment variable (JSON).
async function runScriptFile(
  scriptPath: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const abs = resolve(scriptPath);
  const wrapper = [
    `import fn from ${JSON.stringify(abs)};`,
    `const params = JSON.parse(process.env.__MCP_RESOLVER_PARAMS ?? "{}");`,
    `const result = await Promise.resolve(fn(params));`,
    `process.stdout.write(JSON.stringify(result));`,
  ].join("\n");

  return new Promise((res, rej) => {
    const child = spawn("node", ["--input-type=module"], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, __MCP_RESOLVER_PARAMS: JSON.stringify(params) },
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        return rej(
          new Error(`Resolver script '${scriptPath}' exited with code ${code ?? "null"}`),
        );
      }
      try {
        res(JSON.parse(output));
      } catch {
        rej(new Error(`Resolver script output is not valid JSON: ${output}`));
      }
    });
    child.on("error", rej);
    child.stdin.write(wrapper);
    child.stdin.end();
  });
}
