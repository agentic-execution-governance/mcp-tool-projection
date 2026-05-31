# The Tool Surface Is the Product

_A different way to think about MCP tool governance._

Most agent systems are described from the model outward. We talk about prompts,
reasoning, memory, retrieval, and orchestration. Then, somewhere near the end of
the diagram, we draw a box called "tools" and connect it to everything else.

That box is doing more work than the diagram admits.

For an AI agent, tools are not just integrations. They are the physical laws of
the environment. A model can only observe what its tools reveal, and it can only
act through the operations those tools expose. If an agent has a `delete_file`
tool, then deletion is part of its universe. If it has a `send_email` tool with a
free-form recipient field, then arbitrary outbound email is part of its universe.
If a search tool lets the caller choose an unlimited result count, then cost and
latency are part of the decision space handed to the model.

The central idea of this project is simple: **the tool surface deserves its own
control plane**.

`mcp-tool-projection` is an experiment in building that control plane for MCP
servers. It lets you take arbitrary upstream MCP tools and project them into a
smaller, safer, more intentional interface without writing a custom wrapper for
each tool.

---

## The Problem: Servers Expose Capabilities, Agents Need Roles

MCP servers are intentionally general. A filesystem server may expose reading,
writing, listing, moving, and deleting. A GitHub server may expose issue search,
pull request review, branch operations, and repository mutation. A messaging
server may expose both reading and sending.

That generality is useful for humans and for infrastructure. It is not always
what an agent should see.

A production customer-support agent may need to search documentation, read
recent tickets, and draft responses. It probably should not delete emails,
modify repositories, search local files outside a narrow directory, or call
expensive endpoints with unbounded parameters. A development agent may need a
mocked payment API. A demo agent may need canned responses. A test agent may
need deterministic behavior that never touches real systems.

The upstream server exposes a capability set. The agent needs a role-specific
surface.

Without a projection layer, teams usually solve this with code:

- write a wrapper around the MCP server
- intercept `tools/list`
- remove dangerous tools
- rewrite JSON schemas
- lock parameters
- add logging
- mock side-effecting calls
- repeat the same pattern for the next server

That works until it becomes a second integration platform. Each wrapper encodes
policy as imperative logic. The result is hard to audit, hard to diff, and easy
to let drift away from the original governance intent.

This project asks a different question: what if tool governance looked more like
configuration than application code?

---

## Projection: A View Over a Tool

A projection is a declarative view over one upstream MCP tool.

It says: given this server and this tool, expose it to callers in this particular
way. The projection lives in YAML or JSON. The engine reads it, validates it, and
applies it at runtime.

```yaml
name: search-small-safe
kind: partial
server: brave-search
tool: brave_web_search
projectedName: search
params:
  count: 5
  safesearch: strict
readonly: true
```

This projection turns a general-purpose web search tool into a narrower tool
named `search`. The agent no longer has to decide how many results to request or
which safe-search mode to use. Those decisions have been made outside the model,
in a file that can be reviewed, versioned, and changed deliberately.

That is the mental model: a projection is not a new tool implementation. It is a
controlled presentation of an existing tool.

---

## Four Useful Transformations

The project currently supports four projection kinds. They are small on purpose.
Together, they cover a surprising amount of real governance work.

### `verbatim`

`verbatim` is explicit pass-through.

The tool is exposed unchanged, except that it may be renamed with
`projectedName`. At first this sounds boring, but it is important. An explicit
pass-through is a governance decision: this tool was reviewed and intentionally
made available as-is.

It also cleans up awkward upstream names. An agent does not need to see
`brave_web_search` if the role-specific surface should simply expose `search`.

### `partial`

`partial` fixes some parameters before the call reaches the upstream tool.

This is the workhorse projection. It can lock a search count, fix a filesystem
root, set a tenant ID, force a sender identity, or preconfigure any other
parameter that should be policy rather than model choice.

The projected tool schema is also reduced. Fixed parameters are stripped from
the exposed input schema, so the caller is not merely told not to change them.
It does not see them as inputs.

With `readonly: true`, a partial projection can also reject caller parameters
outside the declared set. That gives the projection a stricter mode for cases
where you want a tight whitelist rather than a permissive merge.

### `simulated`

`simulated` returns a response without calling the upstream server.

This makes testing and demos much easier. You can let an agent believe it has
called a real tool while keeping the world unchanged. A payment charge can be
simulated. A weather lookup can be deterministic. A risky production operation
can return a safe explanatory response.

Simulation is not just a testing trick. It is a way to separate agent behavior
from system side effects while you are still designing, evaluating, or reviewing
the agent.

### `absent`

`absent` removes a tool from the exposed surface.

The tool does not appear in `tools/list`, and calls to it are rejected. This is
more robust than telling a model "do not use this tool" in a prompt. The
capability is no longer in the agent's vocabulary.

If `partial` is about narrowing a capability, `absent` is about removing one.

---

## The Proxy: Where Policy Becomes Runtime Behavior

Projection files are useful by themselves, but the system becomes interesting
when they are placed in front of real MCP servers.

`mcp-proj serve` starts a proxy MCP server. Clients connect to the proxy instead
of connecting directly to the upstream. The proxy handles `tools/list` and
`tools/call`, applying the configured projections along the way.

From the client's perspective, this is just another MCP server. From the
operator's perspective, it is a governance layer:

- absent tools disappear from discovery
- partial tools expose reduced schemas
- simulated tools avoid real upstream calls
- verbatim tools pass through intentionally
- projected names become the names the agent sees

This placement matters. The rules are enforced outside the model and outside
the upstream server. The model cannot prompt its way around a missing tool, and
the upstream server does not need to know about every role-specific policy that
different agents require.

The proxy becomes the boundary where a general integration is turned into a
purpose-built interface.

---

## Profiles: A Tool Surface for a Whole Agent

Real agents rarely use one server. They use search, files, GitHub, Slack,
databases, internal APIs, and mocked services all at once. A meaningful policy
has to describe the whole world the agent can act in.

That is what profiles are for.

A profile is a single YAML file that composes multiple upstream servers and
their projections into one effective tool surface.

```yaml
name: production-support-agent
description: Restricted tool surface for a production support agent
collision: prefix

servers:
  - upstream: brave-search
    projections:
      - kind: partial
        name: safe-search
        tool: brave_web_search
        projectedName: search
        params:
          count: 5
          safesearch: strict

  - upstream: slack
    projections:
      - kind: absent
        name: no-channel-posts
        tool: post_message

  - upstream: github
    projections:
      - kind: verbatim
        name: read-issues
        tool: search_issues
        projectedName: issues_search
```

This file answers a concrete operational question: what can this agent do?

It is more precise than "the agent has access to Brave, Slack, and GitHub." That
statement names infrastructure. The profile names the usable capabilities after
policy has been applied.

Profiles also deal with tool-name collisions. If two servers expose the same
tool name, the profile can reject the configuration, prefix conflicting names,
or keep the first. That may sound mundane, but it is part of making the tool
surface predictable. Agents should not depend on accidental ordering or hidden
name shadowing.

---

## Resolvers: Dynamic Policy Without Giving Up the Model

Static YAML handles many policies, but not all of them.

Sometimes a parameter must be derived from the caller's input. Sometimes a
simulated result should come from an internal service. Sometimes a policy needs
small bits of logic while the overall declaration should remain readable.

Resolvers provide that escape hatch.

A `paramResolver` can compute final parameters for a `partial` projection:

```yaml
name: corporate-email
kind: partial
server: email-server
tool: send_email
paramResolver:
  type: inline-js
  script: |
    ({ user, ...rest }) => ({ ...rest, recipient: user + "@example.com" })
```

A `resultResolver` can compute the response for a `simulated` projection:

```yaml
name: weather-demo
kind: simulated
server: weather-server
tool: get_weather
resultResolver:
  type: inline-js
  script: |
    async ({ city }) => [{ type: "text", text: `Weather in ${city}: sunny` }]
```

The important design choice is that resolvers live at defined extension points.
They do not turn every projection into an arbitrary wrapper. The projection
still declares its kind, server, tool, and exposed behavior. The resolver only
fills in the dynamic part.

---

## Registry, Catalog, and UI: Making Governance Usable

Governance systems fail when they are too awkward to use.

This project includes a local server registry so operators can install MCP
server definitions by name instead of passing long config paths everywhere. It
also includes catalog support for discovering installable server definitions.

On top of that, the UI is meant to make profile authoring less brittle. A visual
editor can show raw upstream tools next to the projected surface, highlight
collisions, and make it easier to see what changed when a projection is added.

The goal is not to replace YAML. The goal is to make the YAML easier to create,
inspect, and trust.

---

## Audit: From "What Could It Do?" to "What Did It Do?"

A declared surface answers the first governance question: what is this agent
allowed to call?

Audit logs answer the second: what did it actually call?

The project records projection-aware call metadata, including the projection
name, kind, server, tool, params, response, duration, and error state. That is
useful because the audit log is written at the same layer that applies policy.
It can record not just that a tool was called, but which projected capability
was used.

That distinction matters. A raw upstream log might say `brave_web_search` was
called. A projection-aware log can say the production agent used the
`safe-search` projection, with the policy-applied parameters that actually went
to the upstream.

---

## Why This Belongs Outside the Prompt

Prompt instructions are useful for intent. They are not a strong way to shape
capability.

"Do not delete files" is weaker than not exposing `delete_file`.
"Always use safe search" is weaker than removing `safesearch` from the input
schema and locking it to `strict`.
"Keep costs low" is weaker than fixing `count` to 5.

The model should decide within a well-designed environment. It should not be
responsible for enforcing every boundary of that environment.

That is the heart of tool projection: move capability design out of the prompt
and into an explicit, inspectable layer.

---

## The Security Boundary, Stated Carefully

This project is about governance, not magic.

A projection proxy is not a substitute for authentication, authorization,
network isolation, API key hygiene, or upstream service controls. If an attacker
can edit the profile or bypass the proxy and connect directly to the upstream,
the projection layer cannot protect you from that.

The value is different: it gives teams a practical way to reduce accidental
capability exposure, make role-specific tool surfaces explicit, test agents
against safe substitutes, and create auditable configuration instead of custom
wrapper code.

In other words, it makes the intended path the structured path.

---

## The Bigger Idea

As MCP servers become easier to install, the number of available tools will
grow quickly. That is good for capability and dangerous for clarity. A pile of
tools is not an agent interface. It is raw material.

The interesting design work is deciding what surface an agent should actually
inhabit:

- Which tools exist?
- What are they called?
- Which parameters are fixed?
- Which operations are simulated?
- Which capabilities are absent?
- How are multiple servers composed?
- How is the resulting behavior audited?

`mcp-tool-projection` treats those as first-class questions. It does not ask
every MCP server to implement every organization's policy. It does not ask every
agent developer to write another wrapper. It introduces a declarative layer that
maps general-purpose tools into purposeful agent capabilities.

That is why the tool surface is the product.

The model may be the part everyone watches, but the surface around it determines
what kind of world it can touch.
