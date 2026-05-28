import { getEntry } from "../registry/store.js";
import { callTool } from "../server/client.js";
import type { Projection } from "./schema.js";

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
): Promise<ProjectionResult> {
  switch (projection.kind) {
    case "absent":
      throw new AbsentToolError(projection.name, projection.tool);

    case "simulated":
      return { content: projection.response as unknown[] };

    case "verbatim": {
      const config = resolveServer(projection.server);
      return callTool(config, projection.tool, callerParams);
    }

    case "partial": {
      const config = resolveServer(projection.server);
      // Definition params are defaults; caller params take precedence.
      const merged = { ...projection.params, ...callerParams };
      return callTool(config, projection.tool, merged);
    }
  }
}
