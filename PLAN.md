# MCP Tool Projection — Implementation Plan

## Experiment goal

Prove that tool projections over arbitrary MCP servers can be defined declaratively (YAML/JSON) and executed by a single engine — no per-projection code required.

---

## Phase 0 — Scaffold (1–2 days)

**Deliverable**: runnable TypeScript project, CI, basic CLI skeleton.

- [x] `npm init`, TypeScript config, ESLint, Prettier
- [x] Add `@modelcontextprotocol/sdk`, `zod`, `commander` (CLI), `js-yaml`
- [x] Directory structure: `src/{registry,server,projection,catalog,cli}/`
- [x] `src/cli/index.ts` entry point with `--help`
- [x] Vitest for tests, basic CI workflow (GitHub Actions)

---

## Phase 1 — MCP Server Runner (2–3 days)

**Deliverable**: connect to a local MCP server and list / call tools.

- [x] `src/server/client.ts` — thin wrapper around `@modelcontextprotocol/sdk` StdioClientTransport
- [x] `mcp tools list <server-config>` CLI command — calls `tools/list`, prints tool names + schemas
- [x] `mcp tools call <server-config> <tool> [params-json]` CLI command — calls `tools/call`
- [x] Unit tests with a mock MCP server (in-process stdio pair)

**Exit criterion**: can list and call tools from any stdio MCP server given a config file.

---

## Phase 2 — Local Registry (2–3 days)

**Deliverable**: install, list, and remove MCP server definitions locally.

- [ ] Registry schema: `{ name, transport, command, args, env, installedAt }` — validated with `zod`
- [ ] Storage: `~/.mcp-projection/registry.json` (or XDG config dir)
- [ ] `mcp registry install <path-or-url>` — add a definition
- [ ] `mcp registry list` — list installed servers
- [ ] `mcp registry remove <name>` — remove a definition
- [ ] Registry-aware variants of Phase 1 commands: `mcp tools list <name>` where `<name>` resolves from registry

**Exit criterion**: round-trip install → list tools → call tool using only a server name.

---

## Phase 3 — Projection Engine (3–4 days)

**Deliverable**: load a projection definition file and execute it.

### 3a — Definition schema

```yaml
# projections/search-readonly.yaml
name: search-readonly
server: brave-search          # registry name
tool: brave_web_search
kind: partial
params:
  count: 5
  safesearch: strict
description: "Web search with hardcoded safety and result-count settings"
```

- [ ] `zod` schema for all three kinds (`partial`, `simulated`, `verbatim`)
- [ ] Loader: `src/projection/loader.ts` — reads YAML/JSON, validates, returns typed definition

### 3b — Execution engine

- [ ] `src/projection/engine.ts` — dispatch by kind:
  - `verbatim`: call tool with caller-supplied params as-is
  - `partial`: merge `definition.params` (defaults) with caller-supplied params (overrides), then call
  - `simulated`: return `definition.response` without any MCP call
  - `absent`: suppress the tool from `tools/list` responses; reject any `tools/call` for it with an error
- [ ] `mcp projection run <definition-file> [params-json]` CLI command
- [ ] `mcp projection list <dir>` — list projections in a directory
- [ ] Unit tests for each kind, including param-merge edge cases

**Exit criterion**: all three projection kinds work end-to-end; no per-projection code needed.

---

## Phase 4 — Remote Catalog Integration (2–3 days)

**Deliverable**: browse and install MCP server definitions from `https://github.com/mcp`.

- [ ] `src/catalog/client.ts` — fetch server definitions from the GitHub registry (REST API or raw file fetch)
- [ ] `mcp catalog search <query>` — find servers by name/keyword
- [ ] `mcp catalog install <name>` — fetch definition, add to local registry
- [ ] Cache catalog index locally (TTL: 1 hour)

**Exit criterion**: `mcp catalog install brave-search && mcp projection run projections/search-readonly.yaml` works from scratch.

---

## Phase 5 — Governance & Audit Layer (stretch)

**Deliverable**: every tool call (real or simulated) is logged with metadata.

- [ ] Audit log: append-only JSONL at `~/.mcp-projection/audit.log`
- [ ] Log fields: `timestamp, projectionName, kind, server, tool, params, response, durationMs`
- [ ] `mcp audit tail` — stream recent entries
- [ ] Add `readonly: true` flag to partial projections (block params that aren't in the whitelist)

---

## Open questions / risks

| Question | Risk | Mitigation |
| -------- | ---- | ---------- |
| github.com/mcp catalog schema — is it stable? | Medium | Treat catalog integration as optional; Phase 1–3 work without it |
| stdio vs SSE transport — which servers in the wild use SSE? | Low | Start with stdio; SSE is a config change in the SDK |
| Param merge semantics for `partial` kind — should caller be able to override pre-filled params? | Design | Define explicit policy in schema (`override: allow/deny`) |
| How to test simulated projections don't diverge from real tool schemas? | Medium | Add optional schema validation step against live `tools/list` |

---

## Milestones summary

| Milestone | Phase | Key CLI command |
| --------- | ----- | --------------- |
| Server runner | 1 | `mcp tools list ./server.json` |
| Local registry | 2 | `mcp registry install ./server.json` |
| Projections | 3 | `mcp projection run ./proj.yaml` |
| Catalog | 4 | `mcp catalog install brave-search` |
| Governance | 5 | `mcp audit tail` |
