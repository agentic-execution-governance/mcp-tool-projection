# #11 Define real experiment task, controls, and runbook

**State:** in progress  
**Epic:** #9  
**Created:** 2026-05-31

---

## Summary

Create a durable runbook that defines the exact experiment task, environment controls, run order, reset procedure, and data collection steps.

## Acceptance Criteria

- Runbook committed under `docs/experiments/real-mcp-trace-experiment.md`.
- Exact task prompt is documented.
- Model, settings, repository commit, MCP server configs, and run order are documented.
- Reset procedure between baseline and projected runs is documented.
- Expected output files are listed.

## Notes

Treat the first published result as a case study unless multiple repeated runs are captured.

## Progress

Draft runbook created at `docs/experiments/real-mcp-trace-experiment.md`.

Remaining before this subtask is complete:

- choose and document the actual agent client
- choose and document the model/settings
- choose and document the real MCP server configs
- fill in the manual intervention and reset policy
