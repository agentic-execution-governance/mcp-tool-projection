# #4 Implement token estimation for tool schemas and responses

**State:** open  
**Epic:** #2  
**Created:** 2026-05-28

---

## Summary

Implement a token estimator that approximates the number of tokens consumed by tool schemas (as seen in `tools/list`) and by tool call responses.

## Acceptance criteria

- Estimator uses a character-based or tiktoken-based heuristic (document choice and error margin)
- Works on raw JSON schema strings and on full `tools/list` response payloads
- Exposed as a utility function in `src/trace/tokenEstimator.ts`
- Unit tests cover edge cases: empty schema, schema with nested objects, large array enums
- Estimation error vs. actual tokenizer is documented (acceptable: ≤ 5% on representative samples)

## Notes

Accuracy matters for the article-ready comparison table. If using a heuristic, record the method in a comment so readers can replicate it.
