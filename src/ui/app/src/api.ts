import type { RegistryEntry, ToolInfo, PreviewResult, ProfileDraft } from "./types.ts";

const BASE = "/api";

export async function fetchServers(): Promise<RegistryEntry[]> {
  const r = await fetch(`${BASE}/servers`);
  const j = await r.json() as { servers: RegistryEntry[] };
  return j.servers;
}

export async function fetchTools(serverName: string): Promise<ToolInfo[]> {
  const r = await fetch(`${BASE}/tools/${encodeURIComponent(serverName)}`);
  if (!r.ok) throw new Error(`Failed to load tools for ${serverName}`);
  const j = await r.json() as { tools: ToolInfo[] };
  return j.tools;
}

export async function previewProfile(draft: ProfileDraft): Promise<PreviewResult> {
  const r = await fetch(`${BASE}/profile/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const j = await r.json() as PreviewResult | { error: string };
  if ("error" in j) throw new Error(j.error);
  return j as PreviewResult;
}
