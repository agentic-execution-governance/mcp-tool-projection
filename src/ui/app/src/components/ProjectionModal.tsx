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

export function ProjectionModal({ serverName, initial, onSave, onClose }: Props) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [tool, setTool] = useState(initial?.tool ?? "");
  const [kind, setKind] = useState<ProjectionKind>(initial?.kind ?? "partial");
  const [projectedName, setProjectedName] = useState(initial?.projectedName ?? "");
  const [params, setParams] = useState<Array<[string, string]>>(
    Object.entries(initial?.params ?? {}),
  );
  const [response, setResponse] = useState(
    initial?.response ?? '[{"type":"text","text":"(simulated)"}]',
  );

  useEffect(() => {
    fetchTools(serverName).then(setTools).catch(console.error);
  }, [serverName]);

  function addParam() { setParams((p) => [...p, ["", ""]]); }
  function setParam(i: number, k: string, v: string) {
    setParams((p) => p.map((e, j) => j === i ? [k, v] : e));
  }
  function removeParam(i: number) { setParams((p) => p.filter((_, j) => j !== i)); }

  function handleSave() {
    if (!tool) return;
    const draft: ProjectionDraft = {
      id: initial?.id ?? makeId(),
      tool,
      kind,
      projectedName: projectedName.trim() || undefined,
      params: kind === "partial" ? Object.fromEntries(params.filter(([k]) => k)) : undefined,
      response: kind === "simulated" ? response : undefined,
    };
    onSave(draft);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24, width: 480, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ margin: 0 }}>
          {initial ? "Edit projection" : "Add projection"} — <span style={{ color: "var(--accent)" }}>{serverName}</span>
        </h3>
        <hr className="divider" />

        <div>
          <label>Tool</label>
          <select value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="">— select a tool —</option>
            {tools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label>Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as ProjectionKind)}>
            <option value="partial">partial — fix some params</option>
            <option value="absent">absent — hide the tool</option>
            <option value="simulated">simulated — canned response</option>
            <option value="verbatim">verbatim — pass through</option>
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

        {kind === "partial" && (
          <div>
            <label style={{ marginBottom: 6 }}>Fixed params</label>
            {params.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={k} onChange={(e) => setParam(i, e.target.value, v)} placeholder="param name" style={{ flex: 1 }} />
                <input value={v} onChange={(e) => setParam(i, k, e.target.value)} placeholder="value" style={{ flex: 1 }} />
                <button className="ghost danger" style={{ padding: "4px 8px" }} onClick={() => removeParam(i)}>✕</button>
              </div>
            ))}
            <button className="ghost" onClick={addParam} style={{ fontSize: 12 }}>+ add param</button>
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
