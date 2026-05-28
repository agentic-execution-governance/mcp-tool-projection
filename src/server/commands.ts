import { Command } from "commander";
import { loadServerConfig } from "./config.js";
import { listTools, callTool } from "./client.js";

export const toolsCommand = new Command("tools").description("Interact with a running MCP server");

toolsCommand
  .command("list <config-file>")
  .description("List tools exposed by an MCP server")
  .option("--json", "Output raw JSON")
  .action(async (configFile: string, opts: { json?: boolean }) => {
    const config = loadServerConfig(configFile);
    const tools = await listTools(config);

    if (opts.json) {
      console.log(JSON.stringify(tools, null, 2));
      return;
    }

    for (const tool of tools) {
      console.log(`\n  ${tool.name}`);
      if (tool.description) console.log(`    ${tool.description}`);
      console.log(`    schema: ${JSON.stringify(tool.inputSchema)}`);
    }
  });

toolsCommand
  .command("call <config-file> <tool-name> [params-json]")
  .description("Call a tool on an MCP server")
  .action(async (configFile: string, toolName: string, paramsJson?: string) => {
    const config = loadServerConfig(configFile);
    const params = paramsJson ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};
    const result = await callTool(config, toolName, params);

    if (result.isError) {
      console.error("Tool returned an error:");
      console.error(JSON.stringify(result.content, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify(result.content, null, 2));
  });
