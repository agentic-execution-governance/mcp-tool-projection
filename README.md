# mcp-tool-projection

Declarative tool projections over arbitrary MCP servers — no per-projection code required.

A **projection** is a YAML or JSON file that describes how a tool should be exposed to callers. Four kinds are supported:

| Kind | What it does |
| ---- | ------------ |
| `verbatim` | Pass-through alias — caller params forwarded as-is |
| `partial` | Pre-fills a subset of params; caller supplies the rest |
| `simulated` | Returns a canned response without calling the real server |
| `absent` | Hides the tool entirely; calls are rejected |

A **proxy server** (`mcp-proj serve`) wraps an upstream MCP server and applies a set of projections, producing a new MCP server that any client can connect to.

---

## Setup

```bash
git clone <repo>
cd mcp-tool-projection
npm install
```

All runbooks below use `npm run dev --` which runs TypeScript directly via `tsx`. After `npm run build` you can replace it with `node dist/cli/index.js`.

---

## Phase 0 — Scaffold

Verify the toolchain is working.

```bash
# Show CLI help
npm run dev -- --help

# Run tests
npm test

# Type-check and compile
npm run build
```

Expected output of `--help`:

```text
Usage: mcp-proj [options] [command]

Declarative tool projections over arbitrary MCP servers

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  tools                               Interact with a running MCP server
  registry                            Manage installed MCP server definitions
  projection                          Run and manage tool projections
  serve <upstream> <projections-dir>  Start a projection proxy in front of an upstream MCP server
```

---

## Phase 1 — MCP Server Runner

Connect to any MCP server and inspect or call its tools directly.

A server config is a JSON or YAML file:

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

## Phase 2 — Local Registry

Install server definitions by name so you don't have to pass file paths everywhere.
The registry is stored at `~/.mcp-projection/registry.json`.

### Install a server

```bash
npm run dev -- registry install examples/echo-server.json
# Installed 'echo-server' (2026-05-28T...)
```

### List installed servers

```bash
npm run dev -- registry list
```

```text
  echo-server
    command:  npx tsx examples/echo-server.ts
    installed: 2026-05-28T...
```

### Use a registry name instead of a file path

```bash
# Same as Phase 1, but using the name from the registry
npm run dev -- tools list echo-server
npm run dev -- tools call echo-server add '{"a":10,"b":20}'
```

### Remove a server

```bash
npm run dev -- registry remove echo-server
```

---

## Phase 3 — Projection Engine

Define projections as YAML files and run them directly.

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
  add-absent   [absent]    echo-server/add    Hide the add tool from callers
  add-partial  [partial]   echo-server/add    Add with a fixed first operand of 10
  echo-simulated [simulated] echo-server/echo  Always returns a canned response ...
  echo-verbatim  [verbatim]  echo-server/echo  Pass-through alias for the echo tool
```

---

## Phase 4 — Projection Proxy Server

Wrap an upstream MCP server with a set of projections and expose the result as a new MCP server. Any MCP client connects to the proxy; it never talks to the upstream directly.

The proxy is itself a stdio MCP server, so it can be used anywhere a normal server config is accepted — including as input to `mcp-proj tools list/call`.

### Start a proxy (foreground, stdio)

```bash
npm run dev -- serve echo-server examples/proxy-projections/
# Proxy started: echo-server with 2 projection(s)
```

### Use another mcp-proj command as the client

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

```text
  echo
    Returns the message unchanged
    ...
```

```bash
# Call echo — proxy intercepts with the simulated projection; real server not called
npm run dev -- tools call examples/echo-proxy.json echo '{"message":"hello"}'
```

```json
[{ "type": "text", "text": "(response from projection, not the real server)" }]
```

```bash
# Compare against raw upstream — add is still there, echo returns the real value
npm run dev -- tools list examples/echo-server.json
npm run dev -- tools call examples/echo-server.json echo '{"message":"hello"}'
```

### Using a real MCP server

Replace `examples/echo-server.json` with any MCP server config, e.g.:

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

## Running tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

25 tests across 5 test files covering the server client, registry store, projection engine (all 4 kinds + param-merge edge cases), and proxy server integration.
