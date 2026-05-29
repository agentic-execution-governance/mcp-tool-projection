# #8 Produce article-ready comparison table from trace data

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Run both demo profiles against a representative agent task, capture JSONL traces, and produce a clean Markdown comparison table suitable for inclusion in a technical article.

## Acceptance criteria

- Traces captured for both `full-40.yaml` and `minimal-4.yaml` runs
- `trace summarize` diff output used as the source of truth
- Final table includes all 9 key metrics with absolute values and deltas
- Table committed to `docs/comparison-table.md`
- Numbers are reproducible: the task prompt, model, and seed are documented alongside the table

## Example table shape

| Metric                    | Full (40 tools) | Minimal (4 tools) | Delta |
| ------------------------- | --------------- | ----------------- | ----- |
| `total_exposed_tools`     | 40              | 4                 | −36   |
| `estimated_schema_tokens` | ~12 000         | ~800              | −93%  |
| `actual_tools_called`     | 3               | 3                 | 0     |
| `unused_tools_exposed`    | 37              | 1                 | −36   |
| `latency_delta_ms`        | —               | —                 | TBD   |

## Notes

This is the final deliverable of the epic and the primary output for the "least privilege pays off" thesis.
