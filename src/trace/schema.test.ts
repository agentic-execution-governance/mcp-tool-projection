import { describe, it, expect } from "vitest";
import { TraceEventSchema, ToolsListEventSchema, ToolsCallEventSchema } from "./schema.js";

const baseList = {
  timestamp: "2026-05-28T12:00:00.000Z",
  event_type: "tools_list" as const,
  profile: "minimal-4",
  latency_ms: 45,
  total_tools: 4,
  schema_bytes: 4321,
  estimated_schema_tokens: 1200,
  result_bytes: 4400,
};

const baseCall = {
  timestamp: "2026-05-28T12:00:01.000Z",
  event_type: "tools_call" as const,
  profile: "minimal-4",
  tool_name: "brave_web_search",
  latency_ms: 320,
  schema_bytes: 512,
  estimated_schema_tokens: 143,
  result_bytes: 1024,
  estimated_result_tokens: 285,
};

describe("ToolsListEventSchema", () => {
  it("accepts a valid tools_list event", () => {
    expect(ToolsListEventSchema.safeParse(baseList).success).toBe(true);
  });

  it("accepts null profile", () => {
    expect(ToolsListEventSchema.safeParse({ ...baseList, profile: null }).success).toBe(true);
  });

  it("rejects negative latency_ms", () => {
    expect(ToolsListEventSchema.safeParse({ ...baseList, latency_ms: -1 }).success).toBe(false);
  });

  it("rejects non-datetime timestamp", () => {
    expect(ToolsListEventSchema.safeParse({ ...baseList, timestamp: "not-a-date" }).success).toBe(
      false,
    );
  });

  it("rejects missing schema_bytes", () => {
    const rest = { ...baseList };
    delete (rest as Partial<typeof baseList>).schema_bytes;
    expect(ToolsListEventSchema.safeParse(rest).success).toBe(false);
  });
});

describe("ToolsCallEventSchema", () => {
  it("accepts a valid tools_call event", () => {
    expect(ToolsCallEventSchema.safeParse(baseCall).success).toBe(true);
  });

  it("accepts null profile", () => {
    expect(ToolsCallEventSchema.safeParse({ ...baseCall, profile: null }).success).toBe(true);
  });

  it("rejects missing tool_name", () => {
    const rest = { ...baseCall };
    delete (rest as Partial<typeof baseCall>).tool_name;
    expect(ToolsCallEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing result_bytes", () => {
    const rest = { ...baseCall };
    delete (rest as Partial<typeof baseCall>).result_bytes;
    expect(ToolsCallEventSchema.safeParse(rest).success).toBe(false);
  });
});

describe("TraceEventSchema (discriminated union)", () => {
  it("dispatches tools_list correctly", () => {
    const result = TraceEventSchema.safeParse(baseList);
    expect(result.success && result.data.event_type).toBe("tools_list");
  });

  it("dispatches tools_call correctly", () => {
    const result = TraceEventSchema.safeParse(baseCall);
    expect(result.success && result.data.event_type).toBe("tools_call");
  });

  it("rejects unknown event_type", () => {
    expect(TraceEventSchema.safeParse({ ...baseList, event_type: "tools_subscribe" }).success).toBe(
      false,
    );
  });

  it("rejects tools_call missing tool_name via the union", () => {
    const rest = { ...baseCall };
    delete (rest as Partial<typeof baseCall>).tool_name;
    expect(TraceEventSchema.safeParse(rest).success).toBe(false);
  });
});
