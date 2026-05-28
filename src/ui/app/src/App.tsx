import React, { useEffect, useState, useCallback, useRef } from "react";
import { ServerPanel } from "./components/ServerPanel.tsx";
import { ProfilePanel } from "./components/ProfilePanel.tsx";
import { PreviewPanel } from "./components/PreviewPanel.tsx";
import { previewProfile } from "./api.ts";
import { draftToYaml } from "./yaml.ts";
import type { ProfileDraft, PreviewResult } from "./types.ts";

const EMPTY_DRAFT: ProfileDraft = {
  name: "my-profile",
  collision: "error",
  servers: [],
};

export default function App() {
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "yaml">("profile");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute preview whenever the draft changes
  useEffect(() => {
    if (draft.servers.length === 0) {
      setPreview(null);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        setPreview(await previewProfile(draft));
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : String(e));
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
  }, [draft]);

  function addServer(name: string) {
    if (draft.servers.find((s) => s.upstream === name)) return;
    setDraft((d) => ({ ...d, servers: [...d.servers, { upstream: name, projections: [] }] }));
  }

  function downloadYaml() {
    const yaml = draftToYaml(draft);
    const blob = new Blob([yaml], { type: "text/yaml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.name || "profile"}.yaml`;
    a.click();
  }

  const yaml = draftToYaml(draft);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>mcp-proj</span>
          <span style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 13 }}>
            Projection Profile Authoring Tool
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>
            Reset
          </button>
          <button className="primary" onClick={downloadYaml}>
            ↓ Download YAML
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "260px 1fr 280px",
          overflow: "hidden",
        }}
      >
        {/* Left: Servers */}
        <div
          style={{
            borderRight: "1px solid var(--border)",
            overflow: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-dim)",
              margin: 0,
            }}
          >
            Registered Servers
          </h2>
          <ServerPanel
            onAddServer={addServer}
            addedServers={draft.servers.map((s) => s.upstream)}
          />
        </div>

        {/* Center: Profile editor */}
        <div
          style={{
            overflow: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid var(--border)",
              marginBottom: 4,
            }}
          >
            {(["profile", "yaml"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom:
                    activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  borderRadius: 0,
                  color: activeTab === tab ? "var(--accent)" : "var(--text-dim)",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontWeight: activeTab === tab ? 700 : 400,
                }}
              >
                {tab === "profile" ? "Profile Editor" : "YAML"}
              </button>
            ))}
          </div>

          {activeTab === "profile" ? (
            <ProfilePanel draft={draft} onChange={setDraft} />
          ) : (
            <pre style={{ flex: 1 }}>{yaml}</pre>
          )}
        </div>

        {/* Right: Preview */}
        <div
          style={{
            borderLeft: "1px solid var(--border)",
            overflow: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-dim)",
              margin: 0,
            }}
          >
            Effective Tool Surface
            {preview && (
              <span
                style={{
                  marginLeft: 8,
                  fontWeight: 400,
                  textTransform: "none",
                  letterSpacing: 0,
                  color: "var(--text-dim)",
                }}
              >
                ({preview.effective.length} tools)
              </span>
            )}
          </h2>
          <PreviewPanel preview={preview} loading={previewLoading} error={previewError} />
        </div>
      </div>
    </div>
  );
}
