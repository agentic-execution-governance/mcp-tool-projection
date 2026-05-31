# #13 Run baseline and projected experiment traces

**State:** open  
**Epic:** #9  
**Created:** 2026-05-31

---

## Summary

Run the same agent task against both real experiment profiles and capture live JSONL traces.

## Acceptance Criteria

- Baseline trace committed or archived as `traces/experiments/real-full.jsonl`.
- Projected trace committed or archived as `traces/experiments/real-minimal.jsonl`.
- Working tree reset or equivalent state restoration documented between runs.
- Any failed, interrupted, or manually corrected run is documented.
- Raw command transcript or notes are saved under `docs/experiments/`.

## Notes

If traces contain sensitive paths, repository names, or content, produce a redacted copy for publication and keep raw traces private.
