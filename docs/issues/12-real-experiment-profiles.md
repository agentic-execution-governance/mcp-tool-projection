# #12 Create real baseline and projected MCP profiles

**State:** open  
**Epic:** #9  
**Created:** 2026-05-31

---

## Summary

Create real experiment profiles that point at actual MCP servers used for the blog-post experiment.

## Acceptance Criteria

- Baseline profile committed as `profiles/experiments/real-full.yaml`.
- Projected profile committed as `profiles/experiments/real-minimal.yaml`.
- Profiles validate with `mcp-proj profile validate`.
- `profile measure` runs cleanly for both profiles.
- Profile comments explain the task scope and why each projected tool is exposed or hidden.

## Notes

Do not include secrets. Use environment variable references in MCP server config files.
