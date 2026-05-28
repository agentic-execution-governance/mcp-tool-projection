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

- [x] Registry schema: `{ name, transport, command, args, env, installedAt }` — validated with `zod`
- [x] Storage: `~/.mcp-projection/registry.json` (or XDG config dir)
- [x] `mcp registry install <path-or-url>` — add a definition
- [x] `mcp registry list` — list installed servers
- [x] `mcp registry remove <name>` — remove a definition
- [x] Registry-aware variants of Phase 1 commands: `mcp tools list <name>` where `<name>` resolves from registry

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

- [x] `zod` schema for all four kinds (`partial`, `simulated`, `verbatim`, `absent`)
- [x] Loader: `src/projection/loader.ts` — reads YAML/JSON, validates, returns typed definition

### 3b — Execution engine

- [x] `src/projection/engine.ts` — dispatch by kind:
  - `verbatim`: call tool with caller-supplied params as-is
  - `partial`: merge `definition.params` (defaults) with caller-supplied params (overrides), then call
  - `simulated`: return `definition.response` without any MCP call
  - `absent`: suppress the tool from `tools/list` responses; reject any `tools/call` for it with an error
- [x] `mcp projection run <definition-file> [params-json]` CLI command
- [x] `mcp projection list <dir>` — list projections in a directory
- [x] Unit tests for each kind, including param-merge edge cases

**Exit criterion**: all three projection kinds work end-to-end; no per-projection code needed.

---

## Phase 4 — Projection Proxy Server (3–4 days)

**Deliverable**: apply a set of projections to an upstream MCP server and expose the result as a new MCP server. Callers connect to the proxy; it handles `tools/list` and `tools/call` transparently.

### Behaviour

- `tools/list` response is the upstream list with projections applied:
  - `absent` tools are removed
  - `partial`, `verbatim`, `simulated` tools are kept (optionally renamed via `projectedName`)
- `tools/call` routes through the projection engine — the caller never talks to the upstream directly

### Schema addition

```yaml
# projections/add-partial.yaml — same as before, proxy reads the whole dir
name: add-partial
kind: partial
server: echo-server      # still used to find the upstream config
tool: add
params:
  a: 10
```

### Tasks

- [x] `src/proxy/server.ts` — MCP server that wraps an upstream; applies a projection set at startup
- [x] `src/proxy/router.ts` — for each incoming `tools/call`, look up the matching projection and delegate to `runProjection()`; fall through to raw upstream call if no projection matches
- [x] `mcp-proj serve <upstream-name-or-file> <projections-dir>` CLI command — launches the proxy on stdio (drop-in replacement for the upstream)
- [x] Integration test: proxy started in-process via `InMemoryTransport`; verify absent tools are hidden and partial params are merged

**Exit criterion**: `mcp-proj serve echo-server projections/` can be used as an MCP server where `add` is absent and `add-partial` is exposed with pre-filled `a`.

---

## Phase 5 — Profile / World (3–4 days)

**Deliverable**: a single file that defines a coherent tool surface across _multiple_ upstream MCP servers. A Profile is to projections what a Kubernetes manifest is to env vars — individual entries can be inline or referenced from external files.

### Concept

The current proxy (Phase 4) wraps one upstream. A Profile composes _N_ upstreams with per-server projection sets and presents a single, unified `tools/list` to the client. The proxy learns to consume a Profile instead of (or in addition to) a bare upstream + projections-dir pair.

```text
Profile
 ├── server: brave-search
 │    ├── projection (inline):  absent → brave_image_search
 │    └── projection (file ref): projections/search-readonly.yaml
 └── server: email-server
      ├── projection (file ref): projections/send-corporate-email.yaml
      └── projection (inline):  absent → delete_email
```

### File format

```yaml
# profiles/production.yaml
name: production
description: "Restricted, audited tool surface for production agents"

servers:
  - upstream: brave-search          # registry name or inline server config
    projections:
      - file: projections/search-readonly.yaml   # file reference
      - kind: absent                             # inline projection
        name: hide-image-search
        tool: brave_image_search

  - upstream: email-server
    projections:
      - file: projections/send-corporate-email.yaml
      - kind: absent
        name: no-delete
        tool: delete_email
```

Inline projections follow the same schema as standalone files (same zod union), minus the top-level `server` field (it is inherited from the enclosing `servers` entry).

### Tool name collisions

When two upstreams expose a tool with the same name the Profile must declare a resolution strategy (default: `error`):

```yaml
collision: prefix        # rewrite conflicting tools as <server>__<tool>
# collision: error       # (default) refuse to start
# collision: first       # keep the first server's tool, silently drop others
```

### Profile tasks

- [ ] `src/profile/schema.ts` — zod schema for `ProfileSchema`; inline projection entries omit `server` and are unioned with a `{ file: string }` reference type
- [ ] `src/profile/loader.ts` — load a profile file; resolve file-referenced projections; validate the merged result
- [ ] `src/profile/resolver.ts` — expand a Profile into a flat `Map<serverName, ProjectionSet>`; apply collision strategy
- [ ] `src/proxy/server.ts` — extend `createProxyServer` / `serveStdio` to accept a Profile in addition to a single upstream + projection set
- [ ] `mcp-proj profile validate <profile-file>` — parse, resolve all file refs, report errors
- [ ] `mcp-proj profile list <profile-file>` — print the effective tool surface (server → tool → kind)
- [ ] `mcp-proj serve --profile <profile-file>` — start the proxy using a Profile
- [ ] Unit tests: file refs resolved correctly; inline projections parsed; collision strategies enforced

**Exit criterion**: `mcp-proj serve --profile profiles/production.yaml` starts a proxy that hides and scopes tools from multiple upstream servers, described entirely in one file.

---

## Phase 6 — Dynamic Resolvers (3–4 days)

**Deliverable**: projection params and simulated responses can be computed at call-time by a resolver script, not just hardcoded in the definition file.

### Two resolver kinds

**Param resolver** (extends `partial`) — a script that receives the caller's raw params and returns the final merged params. Example use-case: append `@example.com` to a `user` argument to build a `recipient` address for a `send_corporate_email` tool.

```yaml
name: send-corporate-email
kind: partial
server: email-server
tool: send_email
paramResolver:
  type: inline-js
  script: |
    ({ user, ...rest }) => ({ ...rest, recipient: user + "@example.com" })
```

**Result resolver** (extends `simulated`) — a script that runs instead of returning a static response. Example use-case: call an internal HTTP endpoint and return its output as the tool result.

```yaml
name: weather-mock
kind: simulated
server: weather-server
tool: get_weather
resultResolver:
  type: inline-js
  script: |
    async ({ city }) => [{ type: "text", text: `Weather in ${city}: sunny` }]
```

### Resolver types (first iteration)

- `inline-js` — a JS arrow function evaluated with `new AsyncFunction()`; receives caller params, returns content array (for result resolver) or params object (for param resolver)
- `script-file` — path to a `.mjs` / `.ts` script that default-exports the same function signature

### Resolver tasks

- [ ] `src/resolvers/types.ts` — zod schema for `ParamResolver` and `ResultResolver` unions
- [ ] `src/resolvers/runner.ts` — `runParamResolver(resolver, params)` and `runResultResolver(resolver, params)`
- [ ] Extend `PartialProjectionSchema` with optional `paramResolver` field; when present, resolver output replaces the static `params` merge
- [ ] Extend `SimulatedProjectionSchema` with optional `resultResolver` field; when present, resolver runs instead of returning `response`
- [ ] Sandbox consideration: `inline-js` runs in the same process — document the trust model; `script-file` is run via `node --input-type=module` child process for isolation
- [ ] Unit tests: param resolver receives merged params correctly; result resolver output is returned as content; static fallback still works when resolver is absent

**Exit criterion**: a `partial` projection with `paramResolver` can transform caller params before the tool is called; a `simulated` projection with `resultResolver` can return dynamically computed content.

---

## Phase 7 — Remote Catalog Integration (2–3 days)

**Deliverable**: browse and install MCP server definitions from `https://github.com/mcp`.

- [ ] `src/catalog/client.ts` — fetch server definitions from the GitHub registry (REST API or raw file fetch)
- [ ] `mcp catalog search <query>` — find servers by name/keyword
- [ ] `mcp catalog install <name>` — fetch definition, add to local registry
- [ ] Cache catalog index locally (TTL: 1 hour)

**Exit criterion**: `mcp catalog install brave-search && mcp projection run projections/search-readonly.yaml` works from scratch.

---

## Phase 8 — Governance & Audit Layer (stretch)

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
| Proxy server | 4 | `mcp-proj serve echo-server projections/` |
| Profile / World | 5 | `mcp-proj serve --profile profiles/production.yaml` |
| Dynamic resolvers | 6 | _(config-driven, no new command)_ |
| Catalog | 7 | `mcp catalog install brave-search` |
| Governance | 8 | `mcp audit tail` |
