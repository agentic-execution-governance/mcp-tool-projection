import { listTools } from "../server/client.js";
import { runProjection, AbsentToolError } from "../projection/engine.js";
import { loadProjection } from "../projection/loader.js";
import type { ServerConfig } from "../server/config.js";
import type { Projection } from "../projection/schema.js";
import type { ToolInfo } from "../server/client.js";

export type ProjectionSet = Map<string, Projection>; // keyed by original tool name

export function loadProjectionSet(projections: Projection[]): ProjectionSet {
  return new Map(projections.map((p) => [p.tool, p]));
}

// ─── tools/list ───────────────────────────────────────────────────────────────

export async function proxyListTools(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
): Promise<ToolInfo[]> {
  const tools = await listTools(upstream);
  return tools
    .filter((t) => projectionSet.get(t.name)?.kind !== "absent")
    .map((t) => {
      const proj = projectionSet.get(t.name);
      return proj ? applyProjectionToTool(t, proj) : t;
    });
}

// Rename and/or strip fixed params from a tool's schema based on its projection.
export function applyProjectionToTool(tool: ToolInfo, proj: Projection): ToolInfo {
  const name = proj.projectedName ?? tool.name;

  if (proj.kind === "partial" && Object.keys(proj.params).length > 0) {
    return {
      ...tool,
      name,
      inputSchema: stripFixedParams(tool.inputSchema, Object.keys(proj.params)),
    };
  }

  return { ...tool, name };
}

// Remove fixed param keys from a JSON Schema object (properties + required).
export function stripFixedParams(schema: object, fixed: string[]): object {
  if (!fixed.length) return schema;
  const s = schema as Record<string, unknown>;
  if (s.type !== "object") return schema;

  const props = Object.fromEntries(
    Object.entries((s.properties as Record<string, unknown>) ?? {}).filter(
      ([k]) => !fixed.includes(k),
    ),
  );
  const required = Array.isArray(s.required)
    ? (s.required as string[]).filter((k) => !fixed.includes(k))
    : undefined;

  return { ...s, properties: props, ...(required !== undefined ? { required } : {}) };
}

// ─── tools/call ───────────────────────────────────────────────────────────────

export async function proxyCallTool(
  upstream: ServerConfig,
  projectionSet: ProjectionSet,
  calledName: string,
  callerParams: Record<string, unknown>,
) {
  // Match by projected name (proj.projectedName ?? proj.tool) to support renamed tools.
  const proj = findByExposedName(projectionSet, calledName);

  if (proj) {
    if (proj.kind === "absent") {
      throw new AbsentToolError(proj.name, proj.tool);
    }
    return runProjection(proj, callerParams, upstream);
  }

  // No projection for this tool — call upstream directly.
  const { callTool } = await import("../server/client.js");
  return callTool(upstream, calledName, callerParams);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function findByExposedName(
  projectionSet: ProjectionSet,
  exposedName: string,
): Projection | undefined {
  for (const proj of projectionSet.values()) {
    if ((proj.projectedName ?? proj.tool) === exposedName) return proj;
  }
  return undefined;
}

export async function buildProjectionSetFromFiles(files: string[]): Promise<ProjectionSet> {
  const projections = files.map((f) => loadProjection(f));
  return loadProjectionSet(projections);
}
