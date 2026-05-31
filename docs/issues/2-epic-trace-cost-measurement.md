# #2 Epic: MCP Tool Surface Trace & Cost Measurement

**State:** open  
**Labels:** epic  
**Created:** 2026-05-28

---

## Goal

Measure how much context, latency, and tool-selection noise is introduced by exposing large MCP environments to agents.

Compare a broad profile with many upstream MCP servers against a minimal projected profile for the same task.

## Deliverables

- JSONL trace format for `tools/list` and `tools/call`
- Token estimation for tool schemas and responses
- `profile measure` command for static surface analysis
- `trace summarize` command for comparing runs
- Demo profiles:
  - `profiles/full-40.yaml`
  - `profiles/minimal-4.yaml`
- Article-ready comparison table

## Key Metrics

| Metric                    | Description                           |
| ------------------------- | ------------------------------------- |
| `tools_list_calls`        | Number of `tools/list` invocations    |
| `total_exposed_tools`     | Total tools surfaced to the agent     |
| `total_schema_bytes`      | Raw byte size of all tool schemas     |
| `estimated_schema_tokens` | Token estimate for all schemas        |
| `actual_tools_called`     | Tools actually invoked during the run |
| `unused_tools_exposed`    | Tools exposed but never called        |
| `exposed_to_used_ratio`   | Ratio of exposed to used tools        |
| `schema_token_reduction`  | Token savings from projection         |
| `latency_delta_ms`        | Latency difference between profiles   |

## Thesis

> Least privilege for agents is not only safer. It is cheaper, cleaner, and easier for the model to reason over.

## Subtasks

- [x] #3 Define JSONL trace format for `tools/list` and `tools/call`
- [x] #4 Implement token estimation for tool schemas and responses
- [x] #5 Implement `profile measure` command for static surface analysis
- [x] #6 Implement `trace summarize` command for comparing runs
- [x] #7 Create demo profiles (`full-40.yaml` and `minimal-4.yaml`)
- [x] #8 Produce article-ready comparison table from trace data
