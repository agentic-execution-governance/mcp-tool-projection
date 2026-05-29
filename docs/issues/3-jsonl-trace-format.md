# #3 Define JSONL trace format for tools/list and tools/call

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Design and document the JSONL trace format used to record `tools/list` and `tools/call` events during an agent run.

## Acceptance criteria

- Schema covers both event types: `tools_list` and `tools_call`
- Each record includes: `timestamp`, `event_type`, `profile`, `tool_name` (where applicable), `schema_bytes`, `latency_ms`, `result_bytes`
- Format is append-only and streamable (one JSON object per line)
- A JSON Schema or zod definition validates trace records at write time
- At least one example trace file committed under `traces/examples/`

## Notes

This is a foundational deliverable — the token estimator, `trace summarize`, and the comparison table all depend on this format being stable.
