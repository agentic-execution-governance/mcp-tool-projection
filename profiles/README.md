# Trace Cost Demo Profiles

These profiles model a concrete agent task: research a small implementation change, inspect repository files, search code, and open a pull request.

- `full-40.yaml` exposes forty tools across search, repository, GitHub, and communication surfaces.
- `minimal-4.yaml` exposes only the four tools needed for the task: web search, file read, code search, and pull request creation.

Both profiles use local fixture MCP servers under `examples/mcp/` so `profile measure` and the trace examples are reproducible without external credentials.
