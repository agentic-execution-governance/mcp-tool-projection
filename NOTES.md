 - Fetch MCPs from a remote catalog/registry: https://github.com/mcp
 - "install" MCP: get an MCP defintion and add it to the local registry
 - "create an MCP server": create a specific MCP configuration
 - "run an MCP server": run a specific MCP configuration
   - observe available tools: tools/list
   - invoke a tool: tools/call
 - "define a tool projection":
   - partial/scoped: a projection with a predefined set of parameters
   - simulated/mocked: a projection that simulates the behavior of a tool without actually invoking it
   - verbatim/raw: a projection that directly passes the input to the tool without any modification

The goal of the experiment:
Provide a mechanism for defining tool projections for arbitrary tools without needing to write a code per projection.