import { getEntry } from "../registry/store.js";
import { callTool } from "../server/client.js";
import { runParamResolver, runResultResolver } from "../resolvers/runner.js";
import { appendAuditEntry } from "../audit/log.js";
import type { Projection } from "./schema.js";
import type { ServerConfig } from "../server/config.js";

export type ProjectionResult = {
  content: unknown[];
  isError?: boolean;
};

export class AbsentToolError extends Error {
  constructor(projection: string, tool: string) {
    super(`Tool '${tool}' is absent under projection '${projection}'`);
    this.name = "AbsentToolError";
  }
}

export class ReadonlyViolationError extends Error {
  constructor(projection: string, extra: string[]) {
    super(`Projection '${projection}' is readonly. Unexpected params: ${extra.join(", ")}`);
    this.name = "ReadonlyViolationError";
  }
}

function resolveServer(serverName: string) {
  const entry = getEntry(serverName);
  if (!entry) {
    throw new Error(
      `Server '${serverName}' not found in registry. Run: mcp-proj registry install <config-file>`,
    );
  }
  return entry;
}

export async function runProjection(
  projection: Projection,
  callerParams: Record<string, unknown> = {},
  configOverride?: ServerConfig,
): Promise<ProjectionResult> {
  const start = Date.now();

  const result = await execute(projection, callerParams, configOverride);

  appendAuditEntry({
    timestamp: new Date().toISOString(),
    projectionName: projection.name,
    kind: projection.kind,
    server: projection.server,
    tool: projection.tool,
    params: callerParams,
    response: result.content,
    durationMs: Date.now() - start,
    isError: result.isError,
  });

  return result;
}

async function execute(
  projection: Projection,
  callerParams: Record<string, unknown>,
  configOverride?: ServerConfig,
): Promise<ProjectionResult> {
  switch (projection.kind) {
    case "absent":
      throw new AbsentToolError(projection.name, projection.tool);

    case "simulated": {
      if (projection.resultResolver) {
        const content = await runResultResolver(projection.resultResolver, callerParams);
        return { content };
      }
      return { content: (projection.response ?? []) as unknown[] };
    }

    case "verbatim": {
      const config = configOverride ?? resolveServer(projection.server);
      return callTool(config, projection.tool, callerParams);
    }

    case "partial": {
      if (projection.readonly) {
        const fixed = Object.keys(projection.params);
        const extra = Object.keys(callerParams).filter(
          (k) => !fixed.includes(k) === false && !fixed.includes(k),
        );
        // readonly: caller may only supply params NOT already in projection.params
        const disallowed = Object.keys(callerParams).filter((k) => fixed.includes(k));
        if (disallowed.length > 0) {
          throw new ReadonlyViolationError(projection.name, disallowed);
        }
      }

      const config = configOverride ?? resolveServer(projection.server);
      let merged: Record<string, unknown>;
      if (projection.paramResolver) {
        merged = await runParamResolver(projection.paramResolver, callerParams);
      } else {
        // Partial application: caller supplies the free params; projection params are fixed.
        merged = { ...callerParams, ...projection.params };
      }
      return callTool(config, projection.tool, merged);
    }
  }
}
