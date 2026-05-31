# #9 Epic: Real MCP Trace Experiment & Blog Post

**State:** open  
**Labels:** epic, experiment, writing  
**Created:** 2026-05-31

---

## Goal

Run a real MCP-agent experiment that compares a broad tool surface against a least-privilege projected surface, then publish the results as a technical blog post.

The experiment should use live MCP traffic, real `tools/list` and `tools/call` traces, and a reproducible setup that another engineer can inspect or rerun.

## Thesis

> Least-privilege MCP profiles reduce schema context, unused tool exposure, and tool-selection noise while preserving task completion for a scoped agent workflow.

## Experiment Shape

- **Baseline profile:** broad real MCP tool surface.
- **Projected profile:** minimal profile for the same task.
- **Task:** one concrete repository-oriented agent task that needs file/code inspection, test execution or validation, and a publishable change summary.
- **Trace source:** live profile proxy traffic captured by `serve --profile --trace`.
- **Output:** reproducible traces, summary tables, qualitative scorecard, and blog draft.

## Controls

Document and keep stable:

- model and model settings
- exact task prompt
- repository commit
- working directory
- MCP server versions/configs
- profile YAML files
- run order
- whether network access was enabled
- any manual intervention

## Deliverables

- Live trace capture for profile proxy runs
- Real baseline and projected experiment profiles
- Experiment runbook
- Captured real traces
- Generated result tables
- Qualitative outcome scorecard
- Blog post draft
- Final claim review before publishing

## Subtasks

- [x] #10 Add live trace capture to `serve --profile --trace`
- [ ] #11 Define real experiment task, controls, and runbook
- [ ] #12 Create real baseline and projected MCP profiles
- [ ] #13 Run baseline and projected experiment traces
- [ ] #14 Generate real comparison tables and scorecard
- [ ] #15 Draft blog post from experiment results
- [ ] #16 Review limitations, claims, and reproducibility before publishing
