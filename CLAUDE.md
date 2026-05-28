# MCP Tool Projection — Project Context

## What this is

An experimental system for defining **tool projections** over arbitrary MCP (Model Context Protocol) servers — without writing code per projection. A projection is a declarative wrapper around an MCP tool that changes how it is called or how it behaves.

## Core concepts

**MCP server** — a process exposing tools via the MCP JSON-RPC protocol (`tools/list`, `tools/call`). Servers are defined by a configuration (transport, command, env) and sourced from a remote catalog (`https://github.com/mcp`) or created locally.

**Local registry** — a persistent store of installed MCP server definitions (configs + metadata). Decoupled from running instances.

**Projection** — a named, declarative description of how a tool should be exposed. Three kinds:
- `partial` — pre-fills a subset of parameters; the caller supplies the rest
- `simulated` — returns a predefined (mock) response without invoking the real tool
- `verbatim` — passes the call through as-is (useful for aliasing or governance tagging)
- `absent` — removes the tool from `tools/list` entirely; any attempt to call it is rejected

**Projection catalog** — a local collection of projection definitions (JSON/YAML), each referencing a server + tool + kind + configuration.

## Goals of the experiment

1. Prove that projections can be defined purely declaratively (no per-projection code).
2. Support all three projection kinds with a single execution engine.
3. Enable governance use-cases: scoping, sandboxing, auditing tool calls.

## Architecture sketch

```
CLI / SDK
  │
  ▼
Projection Engine          ← load projection definition, resolve kind
  │         │
  │         ▼
  │    Mock/Simulated response (no network call)
  │
  ▼
MCP Client (JSON-RPC)      ← tools/list  |  tools/call
  │
  ▼
MCP Server Process         ← spawned locally or connected via SSE/stdio
  │
  ▼
Remote Catalog (github.com/mcp)  ← install definitions
```

## Tech stack

TypeScript (Node.js). The MCP SDK (`@modelcontextprotocol/sdk`) is the canonical client. Projection definitions are YAML or JSON files.

## Key files (once created)

| Path | Purpose |
|------|---------|
| `src/registry/` | Local registry: install, list, remove server definitions |
| `src/server/` | MCP server lifecycle: spawn, connect, list tools, call tools |
| `src/projection/` | Projection engine: load definitions, execute partial/simulated/verbatim |
| `src/catalog/` | Remote catalog client: fetch from github.com/mcp |
| `src/cli/` | CLI entry point |
| `projections/` | Example projection definition files |
| `tests/` | Unit + integration tests |

## Development conventions

- Each module is independently testable; mock the MCP client at the boundary.
- Projection definition schema is validated with `zod` at load time.
- No per-projection code — if a projection requires custom code, the design is wrong.
- Prefer explicit errors over silent fallbacks; projections must declare their kind explicitly.
