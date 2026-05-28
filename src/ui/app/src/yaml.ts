import type { ProfileDraft, ProjectionDraft } from "./types.ts";

function projectionToYaml(proj: ProjectionDraft, indent = "    "): string {
  const lines: string[] = [];
  lines.push(`${indent}- kind: ${proj.kind}`);
  lines.push(`${indent}  name: ${proj.projectedName ?? proj.tool}-${proj.kind}`);
  lines.push(`${indent}  tool: ${proj.tool}`);
  if (proj.projectedName) lines.push(`${indent}  projectedName: ${proj.projectedName}`);
  if (proj.kind === "partial" && proj.params && Object.keys(proj.params).length) {
    lines.push(`${indent}  params:`);
    for (const [k, v] of Object.entries(proj.params)) {
      lines.push(`${indent}    ${k}: ${v}`);
    }
  }
  if (proj.kind === "simulated" && proj.response) {
    try {
      const arr = JSON.parse(proj.response) as Array<{ type: string; text: string }>;
      lines.push(`${indent}  response:`);
      for (const item of arr) {
        lines.push(`${indent}    - type: ${item.type}`);
        lines.push(`${indent}      text: "${item.text.replace(/"/g, '\\"')}"`);
      }
    } catch {
      lines.push(`${indent}  response: []`);
    }
  }
  return lines.join("\n");
}

export function draftToYaml(draft: ProfileDraft): string {
  const lines: string[] = [];
  lines.push(`name: ${draft.name || "my-profile"}`);
  if (draft.description) lines.push(`description: "${draft.description}"`);
  lines.push(`collision: ${draft.collision}`);
  lines.push("");
  lines.push("servers:");
  for (const server of draft.servers) {
    lines.push(`  - upstream: ${server.upstream}`);
    if (server.projections.length) {
      lines.push("    projections:");
      for (const proj of server.projections) {
        lines.push(projectionToYaml(proj));
      }
    }
  }
  return lines.join("\n");
}
