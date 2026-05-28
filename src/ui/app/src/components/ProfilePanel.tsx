import React, { useState, useEffect } from "react";
import { fetchTools } from "../api.ts";
import { SimulatedResponseEditor } from "./SimulatedResponseEditor.tsx";
import type { ProfileDraft, ProjectionDraft, ToolInfo } from "../types.ts";

type Props = {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
};

type UiKind = "—" | "partial" | "simulated" | "verbatim" | "hidden";

function kindToUi(proj: ProjectionDraft | undefined): UiKind {
  if (!proj) return "—";
  if (proj.kind === "absent") return "hidden";
  if (proj.kind === "verbatim") return "verbatim";
  if (proj.kind === "partial") return "partial";
  if (proj.kind === "simulated") return "simulated";
  return "—";
}

function makeId() { return Math.random().toString(36).slice(2); }

function schemaParams(schema: object): string[] {
  const s = schema as Record<string, unknown>;
  if (s.type !== "object") return [];
  return Object.keys((s.properties as Record<string, unknown>) ?? {});
}

function ToolRow({
  serverName,
  tool,
  projection,
  onChange,
}: {
  serverName: string;
  tool: ToolInfo;
  projection?: ProjectionDraft;
  onChange: (proj: ProjectionDraft | null) => void;
}) {
  const uiKind = kindToUi(projection);
  const params = schemaParams(tool.inputSchema);
  const fixedParams: Record<string, string> = projection?.kind === "partial" ? (projection.params ?? {}) as Record<string, string> : {};

  function setKind(k: UiKind) {
    if (k === "—") { onChange(null); return; }
    const base = { id: projection?.id ?? makeId(), tool: tool.name, projectedName: projection?.projectedName };
    if (k === "hidden") onChange({ ...base, kind: "absent", projectedName: undefined });
    else if (k === "verbatim") onChange({ ...base, kind: "verbatim" });
    else if (k === "partial") onChange({ ...base, kind: "partial", params: fixedParams });
    else if (k === "simulated") onChange({ ...base, kind: "simulated", response: projection?.response ?? '[{"type":"text","text":""}]' });
  }

  function setProjectedName(v: string) {
    if (!projection) return;
    onChange({ ...projection, projectedName: v || undefined });
  }

  function toggleParam(key: string, fixed: boolean, value: string) {
    if (!projection || projection.kind !== "partial") return;
    const next = { ...(projection.params ?? {}) as Record<string, string> };
    if (fixed) next[key] = value;
    else delete next[key];
    onChange({ ...projection, params: next });
  }

  function setParamValue(key: string, value: string) {
    if (!projection || projection.kind !== "partial") return;
    onChange({ ...projection, params: { ...(projection.params ?? {}), [key]: value } });
  }

  function setResponse(v: string) {
    if (!projection || projection.kind !== "simulated") return;
    onChange({ ...projection, response: v });
  }

  const rowBg = uiKind === "hidden" ? "#1a1010" : uiKind === "—" ? "transparent" : "var(--surface2)";
  const textColor = uiKind === "hidden" ? "var(--text-dim)" : "var(--text)";

  return (
    <div style={{ borderRadius: 5, border: `1px solid ${uiKind === "hidden" ? "var(--border)" : uiKind === "—" ? "transparent" : "var(--border)"}`, background: rowBg, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Top row: tool name + kind selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <code style={{ minWidth: 100, color: textColor, textDecoration: uiKind === "hidden" ? "line-through" : "none" }}>
          {tool.name}
        </code>
        <span style={{ color: "var(--text-dim)", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tool.description}
        </span>
        <select
          value={uiKind}
          onChange={(e) => setKind(e.target.value as UiKind)}
          style={{ width: "auto", fontSize: 12, padding: "3px 6px" }}
        >
          <option value="—">— pass-through</option>
          <option value="partial">partial</option>
          <option value="simulated">simulated</option>
          <option value="verbatim">verbatim</option>
          <option value="hidden">hidden</option>
        </select>
      </div>

      {/* "expose as" — available for every non-hidden, non-pass-through kind */}
      {uiKind !== "—" && uiKind !== "hidden" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 110 }}>
          <label style={{ whiteSpace: "nowrap", marginBottom: 0, fontSize: 11 }}>expose as</label>
          <input
            value={projection?.projectedName ?? ""}
            onChange={(e) => setProjectedName(e.target.value)}
            placeholder={tool.name + " (optional rename)"}
            style={{ flex: 1, fontSize: 12 }}
          />
        </div>
      )}

      {uiKind === "partial" && params.length > 0 && (
        <div style={{ paddingLeft: 110, display: "flex", flexDirection: "column", gap: 4 }}>
          {params.map((key) => {
            const isFixed = key in fixedParams;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isFixed}
                  onChange={(e) => toggleParam(key, e.target.checked, fixedParams[key] ?? "")}
                  style={{ width: "auto", accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <code style={{ minWidth: 72, color: isFixed ? "var(--text)" : "var(--text-dim)" }}>{key}</code>
                {isFixed ? (
                  <input
                    value={fixedParams[key] ?? ""}
                    onChange={(e) => setParamValue(key, e.target.value)}
                    placeholder="fixed value"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>caller supplies this</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uiKind === "simulated" && (
        <div style={{ paddingLeft: 110 }}>
          <SimulatedResponseEditor
            value={projection?.response ?? '[{"type":"text","text":""}]'}
            onChange={setResponse}
          />
        </div>
      )}
    </div>
  );
}

export function ProfilePanel({ draft, onChange }: Props) {
  const [serverTools, setServerTools] = useState<Record<string, ToolInfo[] | "loading" | "error">>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(name: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) { next.delete(name); return next; }
      next.add(name);
      if (!serverTools[name]) {
        setServerTools((t) => ({ ...t, [name]: "loading" }));
        fetchTools(name)
          .then((tools) => setServerTools((t) => ({ ...t, [name]: tools })))
          .catch(() => setServerTools((t) => ({ ...t, [name]: "error" })));
      }
      return next;
    });
  }

  function updateMeta(patch: Partial<ProfileDraft>) {
    onChange({ ...draft, ...patch });
  }

  function removeServer(upstream: string) {
    onChange({ ...draft, servers: draft.servers.filter((s) => s.upstream !== upstream) });
  }

  function setToolProjection(serverName: string, proj: ProjectionDraft | null) {
    onChange({
      ...draft,
      servers: draft.servers.map((s) => {
        if (s.upstream !== serverName) return s;
        const without = s.projections.filter((p) => p.tool !== (proj?.tool ?? p.tool) || (proj !== null && p.tool !== proj.tool));
        if (proj === null) {
          // Remove projection for this tool
          return { ...s, projections: s.projections.filter((p) => p.tool !== (s.projections.find(() => true)?.tool)) };
        }
        const exists = s.projections.find((p) => p.tool === proj.tool);
        return {
          ...s,
          projections: exists
            ? s.projections.map((p) => p.tool === proj.tool ? proj : p)
            : [...s.projections, proj],
        };
      }),
    });
  }

  // Correctly remove a projection by tool name
  function removeProjection(serverName: string, toolName: string) {
    onChange({
      ...draft,
      servers: draft.servers.map((s) =>
        s.upstream === serverName
          ? { ...s, projections: s.projections.filter((p) => p.tool !== toolName) }
          : s,
      ),
    });
  }

  function handleToolProjectionChange(serverName: string, toolName: string, proj: ProjectionDraft | null) {
    if (proj === null) {
      removeProjection(serverName, toolName);
    } else {
      onChange({
        ...draft,
        servers: draft.servers.map((s) => {
          if (s.upstream !== serverName) return s;
          const exists = s.projections.find((p) => p.tool === toolName);
          return {
            ...s,
            projections: exists
              ? s.projections.map((p) => p.tool === toolName ? proj : p)
              : [...s.projections, proj],
          };
        }),
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Profile meta */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 2 }}>
            <label>Profile name</label>
            <input value={draft.name} onChange={(e) => updateMeta({ name: e.target.value })} placeholder="my-profile" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Collision</label>
            <select value={draft.collision} onChange={(e) => updateMeta({ collision: e.target.value as ProfileDraft["collision"] })}>
              <option value="error">error</option>
              <option value="prefix">prefix</option>
              <option value="first">first</option>
            </select>
          </div>
        </div>
        <div>
          <label>Description (optional)</label>
          <input value={draft.description ?? ""} onChange={(e) => updateMeta({ description: e.target.value || undefined })} placeholder="What this profile is for…" />
        </div>
      </div>

      {draft.servers.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: 16 }}>
          Add servers from the panel on the left.
        </p>
      )}

      {draft.servers.map((server) => {
        const isOpen = expanded.has(server.upstream);
        const tools = serverTools[server.upstream];
        const toolList = Array.isArray(tools) ? tools : [];
        const nonDefault = server.projections.length;

        return (
          <div key={server.upstream} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer" }}
              onClick={() => toggleExpand(server.upstream)}
            >
              <span style={{ fontWeight: 600 }}>
                {isOpen ? "▾" : "▸"} {server.upstream}
                {nonDefault > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-dim)" }}>
                    {nonDefault} projection{nonDefault !== 1 ? "s" : ""} configured
                  </span>
                )}
              </span>
              <button className="ghost danger" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); removeServer(server.upstream); }}>remove</button>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {tools === "loading" && <p style={{ color: "var(--text-dim)", fontSize: 12 }}>Loading tools…</p>}
                {tools === "error" && <p style={{ color: "var(--red)", fontSize: 12 }}>Failed to load tools. Is the server running?</p>}
                {toolList.map((tool) => {
                  const proj = server.projections.find((p) => p.tool === tool.name);
                  return (
                    <ToolRow
                      key={tool.name}
                      serverName={server.upstream}
                      tool={tool}
                      projection={proj}
                      onChange={(p) => handleToolProjectionChange(server.upstream, tool.name, p)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
