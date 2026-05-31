# #14 Generate real comparison tables and scorecard

**State:** open  
**Epic:** #9  
**Created:** 2026-05-31

---

## Summary

Use `trace summarize` as the source of truth for real experiment metrics, then add a qualitative task outcome scorecard.

## Acceptance Criteria

- Real metric table committed under `docs/experiments/real-results.md`.
- Table is generated from the captured real traces.
- Qualitative scorecard covers task completion, test status, irrelevant calls, failed calls, and unsafe unused exposure.
- Any metric caveats are documented next to the table.

## Notes

Numbers should not be manually massaged. If a trace is noisy, explain the noise.
