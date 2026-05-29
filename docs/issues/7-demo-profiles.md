# #7 Create demo profiles: full-40.yaml and minimal-4.yaml

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Author two projection profile YAML files that serve as the canonical demo pair for the cost measurement experiment.

## Acceptance criteria

- `profiles/full-40.yaml` — exposes ~40 tools from multiple upstream MCP servers with `verbatim` projections (broad, unfiltered surface)
- `profiles/minimal-4.yaml` — exposes exactly 4 tools covering the same task scope, using `partial` and `absent` projections to suppress noise
- Both profiles are valid against the projection schema (zod validation passes)
- A `README` or inline comments explain the task scenario each profile targets
- `profile measure` runs cleanly against both files

## Notes

The choice of task scenario determines which 4 tools land in the minimal profile. Pick a concrete, representative scenario (e.g., "read a file, search code, open a PR, post a comment").
