import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { ServerConfigSchema } from "../server/config.js";
import { addEntry, readRegistry, removeEntry, getEntry } from "./store.js";

export const registryCommand = new Command("registry").description(
  "Manage installed MCP server definitions",
);

registryCommand
  .command("install <path>")
  .description("Install an MCP server definition from a JSON or YAML file")
  .action((filePath: string) => {
    const abs = resolve(filePath);
    const raw = readFileSync(abs, "utf8");
    const parsed = abs.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
    const config = ServerConfigSchema.parse(parsed);
    const entry = addEntry(config);
    console.log(`Installed '${entry.name}' (${entry.installedAt})`);
  });

registryCommand
  .command("list")
  .description("List installed MCP servers")
  .option("--json", "Output raw JSON")
  .action((opts: { json?: boolean }) => {
    const registry = readRegistry();
    const entries = Object.values(registry);

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    if (entries.length === 0) {
      console.log("No servers installed. Run: mcp-proj registry install <config-file>");
      return;
    }

    for (const e of entries) {
      console.log(`  ${e.name}`);
      console.log(`    command:  ${e.command} ${e.args.join(" ")}`);
      console.log(`    installed: ${e.installedAt}`);
    }
  });

registryCommand
  .command("remove <name>")
  .description("Remove an installed MCP server by name")
  .action((name: string) => {
    const removed = removeEntry(name);
    if (removed) {
      console.log(`Removed '${name}'`);
    } else {
      console.error(`No server named '${name}' found in registry`);
      process.exit(1);
    }
  });

registryCommand
  .command("show <name>")
  .description("Show details of an installed server")
  .action((name: string) => {
    const entry = getEntry(name);
    if (!entry) {
      console.error(`No server named '${name}' found in registry`);
      process.exit(1);
    }
    console.log(JSON.stringify(entry, null, 2));
  });
