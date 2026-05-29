# MCP Tool Projection — Implementation Plan

## Experiment goal

Prove that tool projections over arbitrary MCP servers can be defined declaratively (YAML/JSON) and executed by a single engine — no per-projection code required.

---

## Completed phases

| Phase | Deliverable             | Exit criterion                                                                                              |
| ----- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0     | Scaffold                | Runnable TS project with CI and CLI skeleton                                                                |
| 1     | MCP Server Runner       | List and call tools from any stdio MCP server given a config file                                           |
| 2     | Local Registry          | Round-trip install → list tools → call tool using only a server name                                        |
| 3     | Projection Engine       | All four projection kinds work end-to-end; no per-projection code needed                                    |
| 4     | Projection Proxy Server | `mcp-proj serve echo-server examples/projections/` exposes a projected tool surface                         |
| 5     | Profile / World         | `mcp-proj serve --profile examples/profiles/production.yaml` composes multiple upstreams in one file        |
| 6     | Dynamic Resolvers       | `partial` with `paramResolver` transforms params; `simulated` with `resultResolver` returns dynamic content |
| 7     | Remote Catalog          | `mcp catalog install brave-search && mcp projection run …` works from scratch                               |
| 8     | Governance & Audit      | Append-only audit log with `mcp audit tail`; `readonly` flag on partial projections                         |
| 9     | Profile Authoring UI    | `mcp-proj ui` opens a browser editor for building and exporting profile YAML files                          |

---

## Phase 10 — Tool Surface Trace & Cost Measurement

**Epic:** [#2](docs/issues/2-epic-trace-cost-measurement.md)

**Thesis:** Least privilege for agents is not only safer — it is cheaper, cleaner, and easier for the model to reason over.

**Deliverable**: instrument the proxy to record tool surface usage, estimate token costs, and produce a side-by-side comparison between a broad (40-tool) and minimal (4-tool) profile.

### Tasks

- [ ] [#3](docs/issues/3-jsonl-trace-format.md) — Define JSONL trace format for `tools/list` and `tools/call`
- [ ] [#4](docs/issues/4-token-estimation.md) — Implement token estimation for tool schemas and responses (`src/trace/tokenEstimator.ts`)
- [ ] [#5](docs/issues/5-profile-measure-command.md) — `profile measure <profile.yaml>` — static surface report (tool count, schema bytes, estimated tokens)
- [ ] [#6](docs/issues/6-trace-summarize-command.md) — `trace summarize <a.jsonl> [b.jsonl]` — single run summary or side-by-side diff
- [ ] [#7](docs/issues/7-demo-profiles.md) — Author `examples/profiles/full-40.yaml` and `examples/profiles/minimal-4.yaml`
- [ ] [#8](docs/issues/8-comparison-table.md) — Run both profiles, capture traces, produce `docs/comparison-table.md`

**Exit criterion**: `trace summarize full.jsonl minimal.jsonl` produces a table showing token reduction, unused tool ratio, and latency delta between the two profiles.

---

## Open questions / risks

| Question                                                                                        | Risk   | Mitigation                                                                      |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| github.com/mcp catalog schema — is it stable?                                                   | Medium | Treat catalog integration as optional; core phases work without it              |
| stdio vs SSE transport — which servers in the wild use SSE?                                     | Low    | Start with stdio; SSE is a config change in the SDK                             |
| Param merge semantics for `partial` kind — should caller be able to override pre-filled params? | Design | Define explicit policy in schema (`override: allow/deny`)                       |
| How to test simulated projections don't diverge from real tool schemas?                         | Medium | Add optional schema validation step against live `tools/list`                   |
| Token estimator accuracy — character heuristic vs. tiktoken                                     | Medium | Document method and error margin in code; accept ≤ 5% on representative samples |
