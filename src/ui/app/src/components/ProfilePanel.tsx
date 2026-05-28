import React, { useState } from "react";
import { ProjectionModal } from "./ProjectionModal.tsx";
import type { ProfileDraft, ProjectionDraft, ServerDraft } from "../types.ts";

type Props = {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
};

export function ProfilePanel({ draft, onChange }: Props) {
  const [modal, setModal] = useState<{ serverName: string; existing?: ProjectionDraft } | null>(null);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  function updateMeta(patch: Partial<ProfileDraft>) {
    onChange({ ...draft, ...patch });
  }

  function removeServer(upstream: string) {
    onChange({ ...draft, servers: draft.servers.filter((s) => s.upstream !== upstream) });
  }

  function saveProjection(serverName: string, proj: ProjectionDraft) {
    onChange({
      ...draft,
      servers: draft.servers.map((s) => {
        if (s.upstream !== serverName) return s;
        const exists = s.projections.find((p) => p.id === proj.id);
        return {
          ...s,
          projections: exists
            ? s.projections.map((p) => p.id === proj.id ? proj : p)
            : [...s.projections, proj],
        };
      }),
    });
    setModal(null);
  }

  function removeProjection(serverName: string, id: string) {
    onChange({
      ...draft,
      servers: draft.servers.map((s) =>
        s.upstream === serverName
          ? { ...s, projections: s.projections.filter((p) => p.id !== id) }
          : s,
      ),
    });
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

      {/* Server entries */}
      {draft.servers.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: 16 }}>
          Add servers from the panel on the left.
        </p>
      )}

      {draft.servers.map((server) => {
        const isOpen = expandedServer === server.upstream;
        return (
          <div key={server.upstream} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer" }}
              onClick={() => setExpandedServer(isOpen ? null : server.upstream)}
            >
              <span style={{ fontWeight: 600 }}>
                {isOpen ? "▾" : "▸"} {server.upstream}
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-dim)" }}>
                  {server.projections.length} projection{server.projections.length !== 1 ? "s" : ""}
                </span>
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="ghost" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setModal({ serverName: server.upstream }); }}>+ projection</button>
                <button className="ghost danger" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); removeServer(server.upstream); }}>remove</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {server.projections.length === 0 && (
                  <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No projections — all tools pass through.</p>
                )}
                {server.projections.map((proj) => (
                  <div key={proj.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 10px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`tag ${proj.kind}`}>{proj.kind}</span>
                      <code>{proj.projectedName ?? proj.tool}</code>
                      {proj.projectedName && proj.projectedName !== proj.tool && (
                        <span style={{ color: "var(--text-dim)", fontSize: 11 }}>← {proj.tool}</span>
                      )}
                      {proj.kind === "partial" && proj.params && Object.entries(proj.params).map(([k, v]) => (
                        <code key={k} style={{ color: "var(--accent)", fontSize: 11 }}>{k}={v}</code>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="ghost" style={{ fontSize: 11, padding: "2px 6px" }}
                        onClick={() => setModal({ serverName: server.upstream, existing: proj })}>edit</button>
                      <button className="ghost danger" style={{ fontSize: 11, padding: "2px 6px" }}
                        onClick={() => removeProjection(server.upstream, proj.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <ProjectionModal
          serverName={modal.serverName}
          initial={modal.existing}
          onSave={(proj) => saveProjection(modal.serverName, proj)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
