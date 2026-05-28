import { listTools } from "../server/client.js";
import { runProjection, AbsentToolError } from "../projection/engine.js";
import { loadProjection } from "../projection/loader.js";
import type { ServerConfig } from "../server/config.js";
import type { Projection } from "../projection/schema.js";
import type { ToolInfo } from "../server/client.js";

export type ProjectionSet = Map<string, Projection>;

export function loadProjectionSet(projections: Projection[]): ProjectionSet {
  return new Map(projections.map((p) => [p.tool, p]));
}

export async function proxyListTools(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
): Promise<ToolInfo[]> {
  const tools = await listTools(upstream);
  return tools.filter((t) => {
    const proj = projectionSet.get(t.name);
    return !proj || proj.kind !== "absent";
  });
}

export async function proxyCallTool(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
  toolName: string,
  callerParams: Record<string, unknown>,
) {
  const proj = projectionSet.get(toolName);

  if (proj) {
    if (proj.kind === "absent") {
      throw new AbsentToolError(proj.name, toolName);
    }
    return runProjection(proj, callerParams);
  }

  // No projection for this tool — call upstream directly.
  const { callTool } = await import("../server/client.js");
  return callTool(upstream, toolName, callerParams);
}

export async function buildProjectionSetFromFiles(files: string[]): Promise<ProjectionSet> {
  const projections = files.map((f) => loadProjection(f));
  return loadProjectionSet(projections);
}
