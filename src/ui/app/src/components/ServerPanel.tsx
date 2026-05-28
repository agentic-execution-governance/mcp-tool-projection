import React, { useEffect, useState } from "react";
import { fetchServers, fetchTools } from "../api.ts";
import type { RegistryEntry, ToolInfo } from "../types.ts";

type Props = {
  onAddServer: (server: string) => void;
  addedServers: string[];
};

export function ServerPanel({ onAddServer, addedServers }: Props) {
  const [servers, setServers] = useState<RegistryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tools, setTools] = useState<Record<string, ToolInfo[]>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchServers().then(setServers).catch(console.error);
  }, []);

  async function toggleServer(name: string) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!tools[name]) {
      setLoading(name);
      try {
        const t = await fetchTools(name);
        setTools((prev) => ({ ...prev, [name]: t }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(null);
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {servers.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
          No servers registered. Run <code>mcp-proj registry install</code>.
        </p>
      )}
      {servers.map((s) => {
        const isAdded = addedServers.includes(s.name);
        const isOpen = expanded === s.name;
        return (
          <div key={s.name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", cursor: "pointer" }}
              onClick={() => toggleServer(s.name)}
            >
              <span style={{ fontWeight: 600, color: isAdded ? "var(--accent)" : "var(--text)" }}>
                {isOpen ? "▾" : "▸"} {s.name}
              </span>
              <button
                className={isAdded ? "ghost" : "primary"}
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={(e) => { e.stopPropagation(); if (!isAdded) onAddServer(s.name); }}
              >
                {isAdded ? "added" : "+ add to profile"}
              </button>
            </div>
            {isOpen && (
              <div style={{ padding: "0 10px 10px", borderTop: "1px solid var(--border)" }}>
                {loading === s.name ? (
                  <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Loading tools…</p>
                ) : (tools[s.name] ?? []).length === 0 ? (
                  <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>No tools found.</p>
                ) : (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {(tools[s.name] ?? []).map((t) => (
                      <div key={t.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{t.name}</span>
                        <span style={{ color: "var(--text-dim)", fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
