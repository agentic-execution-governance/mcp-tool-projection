# #6 Implement `trace summarize` command for comparing runs

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Add a `trace summarize` CLI command that reads one or two JSONL trace files and produces an aggregate summary of all key metrics, plus a side-by-side diff table when two traces are provided.

## Acceptance criteria

- `trace summarize <trace.jsonl>` — single run summary
- `trace summarize <a.jsonl> <b.jsonl>` — side-by-side comparison (labels: `baseline` vs `projected`)
- Emits all key metrics:
  - `tools_list_calls`, `total_exposed_tools`, `total_schema_bytes`, `estimated_schema_tokens`
  - `actual_tools_called`, `unused_tools_exposed`, `exposed_to_used_ratio`
  - `schema_token_reduction` (diff mode only), `latency_delta_ms` (diff mode only)
- Output formats: `--format table` (default) and `--format json`
- Unit tests cover single and diff modes

## Notes

The diff output of this command is the direct source for the article-ready comparison table.
