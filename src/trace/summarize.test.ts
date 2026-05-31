import { describe, expect, it } from "vitest";
import { compareTraceSummaries, summarizeTraceEvents } from "./summarize.js";
import type { TraceEvent } from "./schema.js";

const events: TraceEvent[] = [
  {
    timestamp: "2026-05-28T12:00:00.000Z",
    event_type: "tools_list",
    profile: "minimal-4",
    latency_ms: 20,
    total_tools: 4,
    schema_bytes: 1600,
    estimated_schema_tokens: 440,
    result_bytes: 1700,
  },
  {
    timestamp: "2026-05-28T12:00:01.000Z",
    event_type: "tools_call",
    profile: "minimal-4",
    tool_name: "read_file",
    latency_ms: 10,
    schema_bytes: 300,
    estimated_schema_tokens: 85,
    result_bytes: 900,
    estimated_result_tokens: 250,
  },
  {
    timestamp: "2026-05-28T12:00:02.000Z",
    event_type: "tools_call",
    profile: "minimal-4",
    tool_name: "create_pull_request",
    latency_ms: 30,
    schema_bytes: 500,
    estimated_schema_tokens: 140,
    result_bytes: 400,
    estimated_result_tokens: 112,
  },
];

describe("summarizeTraceEvents", () => {
  it("summarizes a single trace", () => {
    const summary = summarizeTraceEvents(events);

    expect(summary).toMatchObject({
      tools_list_calls: 1,
      total_exposed_tools: 4,
      total_schema_bytes: 1600,
      estimated_schema_tokens: 440,
      actual_tools_called: 2,
      unused_tools_exposed: 2,
      exposed_to_used_ratio: 2,
      total_latency_ms: 60,
    });
  });
});

describe("compareTraceSummaries", () => {
  it("computes diff metrics", () => {
    const baseline = summarizeTraceEvents([
      { ...events[0], profile: "full-40", total_tools: 40, estimated_schema_tokens: 4000 },
      ...events.slice(1),
    ]);
    const projected = summarizeTraceEvents(events);
    const comparison = compareTraceSummaries(baseline, projected);

    expect(comparison.schema_token_reduction).toBe(3560);
    expect(comparison.schema_token_reduction_percent).toBe(89);
    expect(comparison.latency_delta_ms).toBe(0);
  });
});
