import { Command } from "commander";
import { loadServerConfig } from "./config.js";
import { listTools, callTool } from "./client.js";
import { getEntry } from "../registry/store.js";
import type { ServerConfig } from "./config.js";

function resolveConfig(nameOrFile: string): ServerConfig {
  // If the argument looks like a file path, load it directly.
  if (nameOrFile.includes("/") || nameOrFile.includes(".")) {
    return loadServerConfig(nameOrFile);
  }
  // Otherwise treat it as a registry name.
  const entry = getEntry(nameOrFile);
  if (!entry) {
    console.error(
      `'${nameOrFile}' not found in registry. Run: mcp-proj registry install <config-file>`,
    );
    process.exit(1);
  }
  return entry;
}

export const toolsCommand = new Command("tools").description("Interact with a running MCP server");

toolsCommand
  .command("list <name-or-file>")
  .description("List tools exposed by an MCP server (registry name or config file path)")
  .option("--json", "Output raw JSON")
  .action(async (nameOrFile: string, opts: { json?: boolean }) => {
    const config = resolveConfig(nameOrFile);
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
  .command("call <name-or-file> <tool-name> [params-json]")
  .description("Call a tool on an MCP server (registry name or config file path)")
  .action(async (nameOrFile: string, toolName: string, paramsJson?: string) => {
    const config = resolveConfig(nameOrFile);
    const params = paramsJson ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};
    const result = await callTool(config, toolName, params);

    if (result.isError) {
      console.error("Tool returned an error:");
      console.error(JSON.stringify(result.content, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify(result.content, null, 2));
  });
