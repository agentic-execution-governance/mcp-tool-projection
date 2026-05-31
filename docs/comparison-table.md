# MCP Tool Surface Comparison

Source traces:

- `traces/examples/full-40.jsonl`
- `traces/examples/minimal-4.jsonl`

Source command:

```bash
npm run dev -- trace summarize traces/examples/full-40.jsonl traces/examples/minimal-4.jsonl
```

Task prompt: "Research the requested code change, inspect the repository, search for relevant implementation points, and open a pull request."

Model: not used; this reproducible fixture uses a scripted MCP client trace so the table isolates tool-surface cost from model variability.

Seed: n/a.

| Metric                    | Full (40 tools) | Minimal (4 tools) |          Delta |
| ------------------------- | --------------: | ----------------: | -------------: |
| `tools_list_calls`        |               1 |                 1 |              0 |
| `total_exposed_tools`     |              40 |                 4 |            -36 |
| `total_schema_bytes`      |           11712 |               948 |         -10764 |
| `estimated_schema_tokens` |            3272 |               265 |          -3007 |
| `actual_tools_called`     |               4 |                 4 |              0 |
| `unused_tools_exposed`    |              36 |                 0 |            -36 |
| `exposed_to_used_ratio`   |              10 |                 1 |             -9 |
| `schema_token_reduction`  |            3272 |               265 | +3007 (+91.9%) |
| `latency_delta_ms`        |            5517 |              4474 |          -1043 |
