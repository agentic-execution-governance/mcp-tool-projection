# #10 Add live trace capture to serve --profile --trace

**State:** done  
**Epic:** #9  
**Created:** 2026-05-31

---

## Summary

Add a `--trace <path>` option to `mcp-proj serve --profile` so real MCP clients produce JSONL trace records while interacting with the profile proxy.

## Acceptance Criteria

- `mcp-proj serve --profile <profile.yaml> --trace <trace.jsonl>` appends JSONL records.
- Every `tools/list` request emits a `tools_list` trace record.
- Every `tools/call` request emits a `tools_call` trace record, including failed calls.
- Trace records include latency, byte counts, and token estimates.
- Trace capture does not change MCP responses.
- Unit or integration coverage verifies trace writing through the profile proxy.

## Notes

This is the enabling feature for the real experiment. Static `profile measure` output is useful, but the blog post should rely on live traffic traces.

## Implementation

Implemented with `mcp-proj serve --profile <profile.yaml> --trace <trace.jsonl>`.

The profile proxy now emits:

- `tools_list` for every live `tools/list` request
- `tools_call` for every live `tools/call` request, including unknown or failed calls
- latency, byte counts, schema token estimates, and result token estimates

Coverage: `src/profile/profile.test.ts` verifies JSONL trace writing through an in-process profile proxy.
