# #5 Implement `profile measure` command for static surface analysis

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Add a `profile measure <profile.yaml>` CLI command that loads a projection profile, connects to its servers, calls `tools/list`, and emits a static surface report without running any agent task.

## Acceptance criteria

- Command accepts a profile YAML path as its argument
- Outputs the following metrics to stdout (JSON and human-readable table modes):
  - `total_exposed_tools`
  - `total_schema_bytes`
  - `estimated_schema_tokens`
- Optionally writes a JSONL trace file via `--trace <path>`
- Works offline against `simulated` and `absent` projections (no live server needed)
- Integration test runs against `profiles/minimal-4.yaml`

## Notes

This command enables the "static" half of the comparison — you can diff two profiles without running a full agent task.
