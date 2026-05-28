# mcp-tool-projection

Declarative tool projections over arbitrary MCP servers — no per-projection code required.

A **projection** is a YAML or JSON file that describes how a tool should be exposed to callers. Four kinds are supported:

| Kind | What it does |
| ---- | ------------ |
| `verbatim` | Pass-through alias — caller params forwarded as-is |
| `partial` | Pre-fills a subset of params; caller supplies the rest |
| `simulated` | Returns a canned response without calling the real server |
| `absent` | Hides the tool entirely; calls are rejected |

A **proxy server** (`mcp-proj serve`) wraps one or more upstream MCP servers and applies a set of projections, producing a new MCP server that any client can connect to.

---

## Installation

```bash
git clone <repo>
cd mcp-tool-projection
npm install
```

All runbooks below use `npm run dev --` which runs TypeScript directly via `tsx`. After `npm run build` you can replace it with `node dist/cli/index.js`.

```bash
npm run dev -- --help
```

```text
Usage: mcp-proj [options] [command]

Declarative tool projections over arbitrary MCP servers

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  tools       Interact with a running MCP server
  registry    Manage installed MCP server definitions
  projection  Run and manage tool projections
  serve       Start a projection proxy in front of an upstream MCP server
  profile     Inspect and validate profile files
```

```bash
npm test        # run all tests
npm run build   # type-check and compile
```

---

## Connecting to MCP Servers

Inspect or call any MCP server directly. A server config is a JSON or YAML file:

```json
{
  "name": "echo-server",
  "command": "npx",
  "args": ["tsx", "examples/echo-server.ts"]
}
```

### List tools

```bash
npm run dev -- tools list examples/echo-server.json
```

```text
  echo
    Returns the message unchanged
    schema: {"type":"object","properties":{"message":{"type":"string",...}},...}

  add
    Adds two numbers
    schema: {"type":"object","properties":{"a":{"type":"number"},"b":{"type":"number"}},...}
```

```bash
# Machine-readable JSON output
npm run dev -- tools list examples/echo-server.json --json
```

### Call a tool

```bash
npm run dev -- tools call examples/echo-server.json echo '{"message":"hello"}'
```

```json
[{ "type": "text", "text": "hello" }]
```

```bash
npm run dev -- tools call examples/echo-server.json add '{"a":3,"b":4}'
```

```json
[{ "type": "text", "text": "7" }]
```

---

## Server Registry

Install server definitions by name so you don't have to pass file paths everywhere.
The registry is stored at `~/.mcp-projection/registry.json`.

```bash
npm run dev -- registry install examples/echo-server.json
# Installed 'echo-server' (2026-05-28T...)

npm run dev -- registry list
```

```text
  echo-server
    command:  npx tsx examples/echo-server.ts
    installed: 2026-05-28T...
```

Once installed, use the name anywhere a file path is accepted:

```bash
npm run dev -- tools list echo-server
npm run dev -- tools call echo-server add '{"a":10,"b":20}'
```

```bash
npm run dev -- registry remove echo-server
```

---

## Writing Projections

Define projections as YAML files and run them directly — no code needed.

### Projection file format

```yaml
name: add-partial          # identifier
kind: partial              # verbatim | partial | simulated | absent
server: echo-server        # registry name of the upstream server
tool: add                  # tool to project
description: "..."         # optional

# kind-specific fields:
params:                    # partial: default params (caller can override)
  a: 10
```

```yaml
name: echo-simulated
kind: simulated
server: echo-server
tool: echo
response:
  - type: text
    text: "(simulated)"
```

### Run a projection

```bash
# verbatim — passes params straight to the real tool
npm run dev -- projection run projections/echo-verbatim.yaml '{"message":"hello"}'
```

```json
[{ "type": "text", "text": "hello" }]
```

```bash
# partial — a=10 is pre-filled; caller only needs to supply b
npm run dev -- projection run projections/add-partial.yaml '{"b":5}'
```

```json
[{ "type": "text", "text": "15" }]
```

```bash
# simulated — no server call; returns canned response regardless of params
npm run dev -- projection run projections/echo-simulated.yaml '{"message":"ignored"}'
```

```json
[{ "type": "text", "text": "(simulated)" }]
```

```bash
# absent — tool is hidden; call is rejected immediately
npm run dev -- projection run projections/add-absent.yaml
# Tool 'add' is absent under projection 'add-absent'
# exit 1
```

### List projections in a directory

```bash
npm run dev -- projection list projections/
```

```text
  add-absent     [absent]     echo-server/add    Hide the add tool from callers
  add-partial    [partial]    echo-server/add    Add with a fixed first operand of 10
  echo-simulated [simulated]  echo-server/echo   Always returns a canned response ...
  echo-verbatim  [verbatim]   echo-server/echo   Pass-through alias for the echo tool
```

---

## Running a Projection Proxy

Wrap an upstream MCP server with a set of projections and expose the result as a new MCP server. Any MCP client connects to the proxy; it never talks to the upstream directly.

The proxy is itself a stdio MCP server, so it can be used anywhere a normal server config is accepted — including as input to `mcp-proj tools list/call`.

```bash
npm run dev -- serve echo-server examples/proxy-projections/
# Proxy started: echo-server with 2 projection(s)
```

Create a server config that points at the proxy:

```json
{
  "name": "echo-proxy",
  "command": "npx",
  "args": ["tsx", "src/cli/index.ts", "serve", "echo-server", "examples/proxy-projections/"]
}
```

```bash
# List — add is hidden, only echo is visible
npm run dev -- tools list examples/echo-proxy.json
```

```bash
# Call echo — proxy intercepts with the simulated projection; real server not called
npm run dev -- tools call examples/echo-proxy.json echo '{"message":"hello"}'
```

```json
[{ "type": "text", "text": "(response from projection, not the real server)" }]
```

### Using a real MCP server

```json
{
  "name": "brave-search",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": { "BRAVE_API_KEY": "your-key-here" }
}
```

```bash
npm run dev -- registry install brave-search.json
npm run dev -- serve brave-search projections/
```

---

## Composing Multiple Servers with a Profile

A **profile** is a single YAML file that defines a unified tool surface across multiple upstream MCP servers. It replaces the `<upstream> <projections-dir>` pair with a richer declaration: per-server projection sets, a mix of inline projections and file references, and a strategy for resolving tool name collisions.

```yaml
# profiles/production.yaml
name: production
description: "Restricted tool surface for production agents"
collision: prefix   # error | prefix | first

servers:
  - upstream: brave-search
    projections:
      - file: projections/search-readonly.yaml     # file reference
      - kind: absent                               # inline projection
        name: hide-image-search
        tool: brave_image_search

  - upstream: email-server
    projections:
      - kind: absent
        name: no-delete
        tool: delete_email
```

The `collision` field controls what happens when two upstreams expose a tool with the same name:

| Strategy | Behaviour |
| -------- | --------- |
| `error` (default) | Refuse to start |
| `prefix` | Rename conflicting tools as `<server>__<tool>` |
| `first` | Keep the first server's tool, silently drop the rest |

### Start a profile proxy

```bash
npm run dev -- serve --profile profiles/production.yaml
# Profile proxy started: 'production' — 2 server(s), collision=prefix
```

### Validate and inspect a profile

```bash
# Check that all file references resolve and the schema is valid
npm run dev -- profile validate profiles/production.yaml
# Profile 'production' is valid.
#   Servers: 2, Projections: 3, Collision: prefix

# Print the declared tool surface (no live server connections needed)
npm run dev -- profile list profiles/production.yaml
```

```text
Profile: production
  Restricted tool surface for production agents
  Collision: prefix

  upstream: brave-search
    search-readonly    partial  brave_web_search
    hide-image-search  absent   brave_image_search

  upstream: email-server
    no-delete  absent  delete_email
```

---

## Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

36 tests across 6 test files — server client, registry store, projection engine (all 4 kinds + param-merge edge cases), proxy server integration, and profile loader/resolver/proxy (file refs, inline projections, all three collision strategies).
