import React from "react";
import type { EffectiveTool, PreviewResult } from "../types.ts";

type Props = {
  preview: PreviewResult | null;
  loading: boolean;
  error: string | null;
};

export function PreviewPanel({ preview, loading, error }: Props) {
  if (loading) return <p style={{ color: "var(--text-dim)", padding: 12 }}>Computing…</p>;
  if (error) return <p style={{ color: "var(--red)", padding: 12, fontSize: 12 }}>{error}</p>;
  if (!preview) return <p style={{ color: "var(--text-dim)", padding: 12, fontSize: 12 }}>Add servers to see the effective tool surface.</p>;

  const { effective, collisions } = preview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {collisions.length > 0 && (
        <div style={{ background: "#2a1515", border: "1px solid var(--red)", borderRadius: 6, padding: 10 }}>
          <strong style={{ color: "var(--red)", fontSize: 12 }}>⚠ Tool name collisions</strong>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {collisions.map((c) => <span key={c} className="pill collision">{c}</span>)}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            Change collision to <code>prefix</code> or <code>first</code>, or rename the conflicting projections.
          </p>
        </div>
      )}

      {effective.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No tools in the effective surface (all absent?).</p>
      )}

      {effective.map((t, i) => {
        const isCollision = collisions.includes(t.exposedName);
        return (
          <div key={i} style={{
            background: "var(--surface)", border: `1px solid ${isCollision ? "var(--red)" : "var(--border)"}`,
            borderRadius: 6, padding: "8px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <code style={{ fontWeight: 700, fontSize: 13 }}>{t.exposedName}</code>
              <span className={`tag ${t.kind}`}>{t.kind}</span>
              {isCollision && <span className="pill collision">collision</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {t.server}{t.tool !== t.exposedName ? ` / ${t.tool}` : ""}
              {t.fixedParams && Object.keys(t.fixedParams).length > 0 && (
                <span style={{ marginLeft: 8 }}>
                  {Object.entries(t.fixedParams).map(([k, v]) => (
                    <code key={k} style={{ marginRight: 4 }}>{k}={String(v)}</code>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
