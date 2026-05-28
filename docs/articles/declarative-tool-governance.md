# SQL Views for AI Agent Tools

_Or: why the layer between your agent and your MCP server is the most important layer you're not thinking about._

---

Imagine you're onboarding a new developer. You don't hand them root access to the production database and trust them to only run `SELECT` queries. You create a read-only user, restrict it to specific tables, maybe define a view that pre-joins the data they need. The underlying database hasn't changed. The developer still gets useful access. But the blast radius of a mistake — theirs or yours — shrinks to something survivable.

Now imagine you're deploying an AI agent. You hand it a Brave Search API key and tell it to research competitors. The MCP server for Brave exposes `brave_web_search`, `brave_local_search`, `brave_image_search`, and `brave_video_search`. Your agent only needs web search. The image and video endpoints cost money. The local search endpoint reveals your office's geographic area. You want `count` capped at 5 to control costs and `safesearch` set to `strict` because this agent runs in a customer-facing product.

What do you do?

The naive answer: write a wrapper. Subclass the client, add validation, hard-code the parameters, strip the unwanted tools from the list response. It works. You do it again for the email server (no deleting, no mass-sending). Then again for the filesystem server (read-only, scoped to one directory). Three wrappers later, each a slightly different shape, each requiring maintenance when the upstream MCP SDK updates.

The question this project asks is: **what if none of that required code?**

---

## The Projection Concept

A _projection_ is a declarative description of how a single MCP tool should be exposed to callers. It sits in a YAML file. It references an upstream server and tool by name. It declares a _kind_. That's it.

```yaml
name: search-readonly
server: brave-search
tool: brave_web_search
kind: partial
projectedName: web_search
params:
  count: 5
  safesearch: strict
```

This file says: take `brave_web_search` from the `brave-search` server, expose it as `web_search`, and fix `count` and `safesearch` to those values. The caller — the agent — sees a tool with two fewer parameters. It can't override them. They don't appear in the schema. From the agent's perspective, `web_search` simply works that way.

You didn't write a wrapper. You wrote a config file.

---

## Four Kinds of Projection

The power of the system comes from four orthogonal projection kinds, each capturing a different intent.

### `partial` — Partial Application

The name comes from functional programming. When you partially apply a function, you fix some of its arguments and get back a function that takes the rest. `add(a, b)` partially applied with `a=10` gives you `add_to_ten(b)`.

That's exactly what a `partial` projection does to a tool. The fixed parameters are **locked in** — the caller can't override them, and they don't appear in the tool's input schema. The remaining parameters are the tool's public interface.

This is the projection kind that enforces policy without the agent even knowing policy exists. The agent calls `add_to_ten(b=5)` and gets `15`. It has no idea `a` was ever a parameter.

```yaml
name: add-to-ten
kind: partial
server: echo-server
tool: add
projectedName: add_to_ten
params:
  a: 10
```

A governance example: a `send_email` tool takes `recipient`, `subject`, and `body`. Your corporate email policy says outbound mail must go through `@company.com` addresses only. A `partial` projection locks `recipient_domain` to `@company.com`. The agent supplies the username; the domain is non-negotiable.

### `simulated` — Canned Responses

A `simulated` projection returns a pre-defined response without ever calling the upstream server. No network request. No side effects. The tool "works" from the agent's perspective, but nothing actually happens.

```yaml
name: weather-mock
kind: simulated
server: weather-server
tool: get_weather
response:
  - type: text
    text: "Weather in the requested city: sunny, 22°C"
```

The obvious use is testing and development — run your agent against a simulated environment before connecting it to live services. But `simulated` has subtler governance uses too. You might stub out an expensive API during a demo. You might return a fixed "not available" response for a tool that's temporarily offline. You might use a `resultResolver` (a small inline script) to call your own internal service and return its response, making the agent think it's talking to the original upstream when it's actually talking to your proxy.

### `verbatim` — Explicit Pass-Through

A `verbatim` projection forwards everything as-is. It sounds trivially useless — if you're not changing anything, why have a projection at all?

Two reasons. First, renaming: you can expose a tool under a different name using `projectedName` without altering its behavior. A tool called `brave_web_search` becomes `search`. An internal tool named after a legacy system gets a clean public name without changing the server.

Second, auditability. Declaring a tool as `verbatim` is a statement: _we reviewed this tool and decided to expose it unchanged_. It's the governance equivalent of signing off on a code review. The implicit pass-through of "no projection" is invisible; an explicit `verbatim` is a record of intent.

### `absent` — Removal

An `absent` projection removes a tool from the list entirely. It doesn't appear in `tools/list`. Any attempt to call it is rejected with an error.

```yaml
name: no-delete
kind: absent
server: email-server
tool: delete_email
```

This is the deny-list pattern. You can't call what you can't see. The agent can't "decide" to delete emails because `delete_email` doesn't exist from its point of view. There's no prompt engineering needed to prevent misuse. The capability is simply absent.

---

## Composing Servers: The Profile

Individual projections are useful. But agents usually talk to multiple servers. The interesting governance problem isn't "how do I control one tool" — it's "how do I define a coherent, auditable surface across an entire ecosystem of servers."

A _profile_ is a single YAML file that declares the complete tool surface for an agent. Multiple upstream servers, per-server projection sets, and a strategy for resolving name collisions — all in one place.

```yaml
name: production-agent
description: "Restricted tool surface for the production customer support agent"
collision: prefix

servers:
  - upstream: brave-search
    projections:
      - file: projections/search-readonly.yaml
      - kind: absent
        name: no-images
        tool: brave_image_search

  - upstream: email-server
    projections:
      - kind: partial
        name: corporate-send
        tool: send_email
        projectedName: send_email
        params:
          sender_domain: "@company.com"
      - kind: absent
        name: no-delete
        tool: delete_email
```

This profile is the answer to the question: _what can this agent do?_ Not "what servers is it connected to" — that's infrastructure. The profile defines the _policy_. It's the document you audit, the document you version-control, the document you show to the security team.

The `collision` field handles the case where two servers expose tools with the same name. `error` refuses to start — explicit resolution required. `prefix` renames conflicting tools as `server__tool`. `first` keeps the first server's version and silently drops the rest.

Notably, renaming a tool in one server's projection _resolves_ a collision with another server. If `echo-server-b` exposes `echo` renamed to `say_hi`, there's no collision with `echo-server`'s `echo` — the effective names are different. The collision system operates on exposed names, not upstream names.

---

## Dynamic Behavior: Resolvers

So far, everything is static — fixed parameters, fixed responses. But governance requirements are sometimes dynamic. "Append `@company.com` to the username the agent supplies." "Call our internal rate-limiter before forwarding the request." "Return results from our cache if available."

This is where _resolvers_ come in. A `paramResolver` on a `partial` projection receives the caller's raw parameters and returns the final merged parameter set. A `resultResolver` on a `simulated` projection runs instead of returning the static response.

```yaml
name: corporate-email
kind: partial
server: email-server
tool: send_email
paramResolver:
  type: inline-js
  script: |
    ({ user, ...rest }) => ({ ...rest, recipient: user + "@company.com" })
```

The resolver is a small function — an arrow function in the YAML itself, or a path to an `.mjs` file for more complex logic. The `inline-js` kind runs in the same process (fast, but trusted code only). The `script-file` kind spawns an isolated child process.

This is the escape hatch for when static configuration isn't enough, without abandoning the declarative model. The projection is still a YAML file. The engine still dispatches by kind. The resolver is just a function at one of the dispatch points.

---

## The Proxy Server

All of this is useful in isolation, but the real power emerges when you run the proxy.

`mcp-proj serve --profile profiles/production.yaml`

This command starts a new MCP server. Any client that connects to it sees the projected tool surface. Absent tools are invisible. Partial tools have reduced schemas. Simulated tools respond instantly without touching the upstream.

The proxy is itself a valid MCP server — you can pass it to any MCP client, including the MCP Inspector for debugging. The upstream servers are an implementation detail hidden behind the proxy's interface.

From an architecture standpoint: your agent, your orchestration layer, your LLM — they all talk to the proxy. The proxy talks to the real servers. The projection layer is the seam at which governance is enforced.

---

## Why Declarative?

There's a deeper principle here worth naming.

Every time you enforce governance in code — subclassing, wrapping, intercepting — you create a maintenance artifact. The code has to be written, reviewed, tested, and updated whenever either end changes. The governance intent is implicit, buried in the logic. It's hard to audit because you have to read code to understand what's allowed.

Declarative governance externalizes the intent. The YAML file _is_ the policy. You don't have to read code to know that `delete_email` is absent — it's stated. You don't have to trace a call stack to know that `safesearch` is always `strict` — it's in the file. You can grep for it, diff it, generate a report from it, and show it to a non-engineer.

This is why SQL has views. This is why Kubernetes has RBAC YAML. This is why Nginx has config files instead of just "write a reverse proxy in C." Declarative configuration is readable, auditable, and composable in a way that imperative code fundamentally isn't.

AI agents are becoming the new user-facing systems. The tools they can call are the new APIs. The governance layer we apply to those tools will matter — a lot — for the same reasons the governance layer over databases and APIs has always mattered.

The projection system is an attempt to build that governance layer correctly: outside the model, outside the server, in a format that humans and automated systems can both read and reason about.

---

## What This Is Not

A projection is not a security boundary in the cryptographic sense. A sufficiently motivated user of the system can always reconfigure it. The threat model is **policy enforcement**, not **adversarial containment**. You're protecting against mistakes, scope creep, and accidental misuse — not against an attacker who has control of the configuration files.

A projection also doesn't replace authentication, rate limiting, or proper API key management. It's a layer on top of those, not a substitute.

What it _is_ good for: making the right behavior the easy behavior. Making policy visible instead of implied. Making a whole class of "oops" scenarios structurally impossible by removing the tool from the agent's vocabulary.

---

## A Note on Naming

The word "projection" comes from mathematics and type theory. In a projection, you map a structure to a simpler one by selecting some of its dimensions and discarding others. A 3D point projected onto a plane loses one coordinate. A database row projected through a view loses some columns.

A tool projected through a `partial` projection loses some parameters. A tool projected through `absent` loses its existence. The full tool surface of an MCP server, projected through a profile, becomes a smaller, cleaner surface tailored for a specific agent and a specific purpose.

What the agent sees is not the full server. It's a purposeful subset — governed, shaped, and declared.

That's the projection.
