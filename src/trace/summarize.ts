import { readTraceFile } from "./writer.js";
import type { TraceEvent } from "./schema.js";

export type TraceSummary = {
  label?: string;
  tools_list_calls: number;
  total_exposed_tools: number;
  total_schema_bytes: number;
  estimated_schema_tokens: number;
  actual_tools_called: number;
  unused_tools_exposed: number;
  exposed_to_used_ratio: number | null;
  total_latency_ms: number;
};

export type TraceComparison = {
  baseline: TraceSummary;
  projected: TraceSummary;
  schema_token_reduction: number;
  schema_token_reduction_percent: number | null;
  latency_delta_ms: number;
};

export async function summarizeTraceFile(filePath: string, label?: string): Promise<TraceSummary> {
  const events: TraceEvent[] = [];
  for await (const event of readTraceFile(filePath)) {
    events.push(event);
  }
  return summarizeTraceEvents(events, label);
}

export function summarizeTraceEvents(events: TraceEvent[], label?: string): TraceSummary {
  const listEvents = events.filter((event) => event.event_type === "tools_list");
  const callEvents = events.filter((event) => event.event_type === "tools_call");
  const calledTools = new Set(callEvents.map((event) => event.tool_name));
  const latestList = listEvents.at(-1);
  const totalExposedTools = latestList?.total_tools ?? 0;
  const actualToolsCalled = calledTools.size;

  return {
    label,
    tools_list_calls: listEvents.length,
    total_exposed_tools: totalExposedTools,
    total_schema_bytes: latestList?.schema_bytes ?? 0,
    estimated_schema_tokens: latestList?.estimated_schema_tokens ?? 0,
    actual_tools_called: actualToolsCalled,
    unused_tools_exposed: Math.max(0, totalExposedTools - actualToolsCalled),
    exposed_to_used_ratio:
      actualToolsCalled === 0 ? null : round(totalExposedTools / actualToolsCalled, 2),
    total_latency_ms: events.reduce((total, event) => total + event.latency_ms, 0),
  };
}

export function compareTraceSummaries(
  baseline: TraceSummary,
  projected: TraceSummary,
): TraceComparison {
  const schemaTokenReduction = baseline.estimated_schema_tokens - projected.estimated_schema_tokens;

  return {
    baseline,
    projected,
    schema_token_reduction: schemaTokenReduction,
    schema_token_reduction_percent:
      baseline.estimated_schema_tokens === 0
        ? null
        : round((schemaTokenReduction / baseline.estimated_schema_tokens) * 100, 1),
    latency_delta_ms: projected.total_latency_ms - baseline.total_latency_ms,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
