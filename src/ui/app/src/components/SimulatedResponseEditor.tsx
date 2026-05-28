import React from "react";

export type ContentItem =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; uri: string; text: string };

export function parseResponse(json: string): ContentItem[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length === 0) return [{ type: "text", text: "" }];
    return arr.map((item: Record<string, unknown>) => {
      if (item.type === "image") return { type: "image", data: String(item.data ?? ""), mimeType: String(item.mimeType ?? "image/png") };
      if (item.type === "resource") return { type: "resource", uri: String(item.uri ?? ""), text: String(item.text ?? "") };
      return { type: "text", text: String(item.text ?? "") };
    });
  } catch {
    return [{ type: "text", text: "" }];
  }
}

export function serializeResponse(items: ContentItem[]): string {
  return JSON.stringify(
    items.map((item) => {
      if (item.type === "image") return { type: "image", data: item.data, mimeType: item.mimeType };
      if (item.type === "resource") return { type: "resource", uri: item.uri, text: item.text };
      return { type: "text", text: item.text };
    }),
  );
}

type Props = {
  value: string;
  onChange: (json: string) => void;
};

export function SimulatedResponseEditor({ value, onChange }: Props) {
  const items = parseResponse(value);

  function update(index: number, patch: Partial<ContentItem>) {
    const next = items.map((item, i) => (i === index ? ({ ...item, ...patch } as ContentItem) : item));
    onChange(serializeResponse(next));
  }

  function addItem() {
    onChange(serializeResponse([...items, { type: "text", text: "" }]));
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange(serializeResponse(next.length ? next : [{ type: "text", text: "" }]));
  }

  function changeType(index: number, type: ContentItem["type"]) {
    if (type === "text") update(index, { type: "text", text: "" } as ContentItem);
    else if (type === "image") update(index, { type: "image", data: "", mimeType: "image/png" } as ContentItem);
    else if (type === "resource") update(index, { type: "resource", uri: "", text: "" } as ContentItem);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={item.type}
              onChange={(e) => changeType(i, e.target.value as ContentItem["type"])}
              style={{ width: "auto", fontSize: 11, padding: "2px 6px" }}
            >
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="resource">resource</option>
            </select>
            <span style={{ flex: 1 }} />
            {items.length > 1 && (
              <button className="ghost danger" style={{ fontSize: 11, padding: "1px 6px" }} onClick={() => removeItem(i)}>✕</button>
            )}
          </div>

          {item.type === "text" && (
            <textarea
              value={item.text}
              onChange={(e) => update(i, { text: e.target.value })}
              rows={2}
              placeholder="Response text…"
              style={{ fontFamily: "inherit", fontSize: 13, resize: "vertical" }}
            />
          )}

          {item.type === "image" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>MIME type</label>
                  <input value={item.mimeType} onChange={(e) => update(i, { mimeType: e.target.value })} placeholder="image/png" />
                </div>
              </div>
              <div>
                <label>Base64 data</label>
                <textarea value={item.data} onChange={(e) => update(i, { data: e.target.value })} rows={2} placeholder="base64-encoded image data…" style={{ fontFamily: "monospace", fontSize: 11 }} />
              </div>
            </div>
          )}

          {item.type === "resource" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <label>URI</label>
                <input value={item.uri} onChange={(e) => update(i, { uri: e.target.value })} placeholder="file:///path/to/resource" />
              </div>
              <div>
                <label>Text content</label>
                <textarea value={item.text} onChange={(e) => update(i, { text: e.target.value })} rows={2} placeholder="Resource text content…" style={{ fontFamily: "inherit", fontSize: 13 }} />
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="ghost" onClick={addItem} style={{ fontSize: 12, alignSelf: "flex-start" }}>+ add content item</button>
    </div>
  );
}
