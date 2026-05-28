import React, { useState, useEffect } from "react";
import { fetchTools } from "../api.ts";
import type { ProjectionDraft, ProjectionKind, ToolInfo } from "../types.ts";

type Props = {
  serverName: string;
  initial?: ProjectionDraft;
  onSave: (proj: ProjectionDraft) => void;
  onClose: () => void;
};

function makeId() { return Math.random().toString(36).slice(2); }

function schemaParams(schema: object): string[] {
  const s = schema as Record<string, unknown>;
  if (s.type !== "object") return [];
  return Object.keys((s.properties as Record<string, unknown>) ?? {});
}

export function ProjectionModal({ serverName, initial, onSave, onClose }: Props) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [tool, setTool] = useState(initial?.tool ?? "");
  const [kind, setKind] = useState<ProjectionKind>(initial?.kind ?? "partial");
  const [projectedName, setProjectedName] = useState(initial?.projectedName ?? "");
  // Map of paramName → { fixed: boolean, value: string }
  const [paramRows, setParamRows] = useState<Array<{ key: string; value: string; fixed: boolean }>>([]);
  const [response, setResponse] = useState(
    initial?.response ?? '[{"type":"text","text":"(simulated)"}]',
  );

  useEffect(() => {
    fetchTools(serverName).then(setTools).catch(console.error);
  }, [serverName]);

  // When the selected tool changes, rebuild paramRows from the schema
  useEffect(() => {
    if (!tool) { setParamRows([]); return; }
    const toolInfo = tools.find((t) => t.name === tool);
    if (!toolInfo) return;
    const params = schemaParams(toolInfo.inputSchema);
    const existing = initial?.params ?? {};
    setParamRows(
      params.map((k) => ({
        key: k,
        value: existing[k] ?? "",
        fixed: k in existing,
      })),
    );
  }, [tool, tools]);

  function toggleFixed(i: number) {
    setParamRows((rows) => rows.map((r, j) => j === i ? { ...r, fixed: !r.fixed, value: r.fixed ? "" : r.value } : r));
  }
  function setValue(i: number, value: string) {
    setParamRows((rows) => rows.map((r, j) => j === i ? { ...r, value, fixed: true } : r));
  }

  const selectedTool = tools.find((t) => t.name === tool);
  const allParams = selectedTool ? schemaParams(selectedTool.inputSchema) : [];
  const freeParams = paramRows.filter((r) => !r.fixed).map((r) => r.key);

  function handleSave() {
    if (!tool) return;
    const fixedParams = Object.fromEntries(
      paramRows.filter((r) => r.fixed && r.key).map((r) => [r.key, r.value]),
    );
    const draft: ProjectionDraft = {
      id: initial?.id ?? makeId(),
      tool,
      kind,
      projectedName: projectedName.trim() || undefined,
      params: kind === "partial" ? fixedParams : undefined,
      response: kind === "simulated" ? response : undefined,
    };
    onSave(draft);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24, width: 520, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ margin: 0 }}>
          {initial ? "Edit projection" : "Add projection"} — <span style={{ color: "var(--accent)" }}>{serverName}</span>
        </h3>
        <hr className="divider" />

        <div>
          <label>Tool</label>
          <select value={tool} onChange={(e) => { setTool(e.target.value); setParamRows([]); }}>
            <option value="">— select a tool —</option>
            {tools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label>Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as ProjectionKind)}>
            <option value="partial">partial — fix some params, caller supplies the rest</option>
            <option value="absent">absent — hide the tool entirely</option>
            <option value="simulated">simulated — return a canned response</option>
            <option value="verbatim">verbatim — pass through unchanged</option>
          </select>
        </div>

        {kind !== "absent" && (
          <div>
            <label>Exposed name (projectedName) — optional</label>
            <input
              value={projectedName}
              onChange={(e) => setProjectedName(e.target.value)}
              placeholder={tool || "e.g. add_to_ten"}
            />
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, display: "block" }}>
              Leave empty to keep the original tool name.
            </span>
          </div>
        )}

        {kind === "partial" && tool && (
          <div>
            <label style={{ marginBottom: 8, display: "block" }}>
              Params
              {allParams.length > 0 && (
                <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>
                  — check the ones to fix; leave unchecked for the caller to supply
                </span>
              )}
            </label>

            {paramRows.length === 0 && (
              <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No parameters found in tool schema.</p>
            )}

            {paramRows.map((row, i) => (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={row.fixed}
                  onChange={() => toggleFixed(i)}
                  style={{ width: "auto", accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <code style={{ minWidth: 80, color: row.fixed ? "var(--text)" : "var(--text-dim)" }}>{row.key}</code>
                {row.fixed ? (
                  <input
                    value={row.value}
                    onChange={(e) => setValue(i, e.target.value)}
                    placeholder="fixed value"
                    style={{ flex: 1 }}
                    autoFocus={i === paramRows.findIndex((r) => r.fixed)}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                    caller supplies this
                  </span>
                )}
              </div>
            ))}

            {freeParams.length > 0 && (
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                Free params (caller must supply): {freeParams.map((k) => <code key={k} style={{ marginRight: 4 }}>{k}</code>)}
              </p>
            )}
          </div>
        )}

        {kind === "simulated" && (
          <div>
            <label>Response (JSON content array)</label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave} disabled={!tool}>Save</button>
        </div>
      </div>
    </div>
  );
}
