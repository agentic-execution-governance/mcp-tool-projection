import { Command } from "commander";
import { fetchCatalog, searchCatalog, getCatalogEntry } from "./client.js";
import { addEntry } from "../registry/store.js";

export const catalogCommand = new Command("catalog").description(
  "Browse and install MCP server definitions from the remote catalog",
);

catalogCommand
  .command("search <query>")
  .description("Find servers by name, description, or tag")
  .option("--refresh", "Bypass the local cache and re-fetch the catalog")
  .action(async (query: string, opts: { refresh?: boolean }) => {
    try {
      const catalog = await fetchCatalog(undefined, opts.refresh);
      const results = searchCatalog(catalog, query);
      if (results.length === 0) {
        console.log(`No servers found matching '${query}'.`);
        return;
      }
      for (const s of results) {
        console.log(`  ${s.name}${s.tags.length ? `  [${s.tags.join(", ")}]` : ""}`);
        if (s.description) console.log(`    ${s.description}`);
        if (s.homepage) console.log(`    ${s.homepage}`);
      }
    } catch (err) {
      console.error("Catalog error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

catalogCommand
  .command("install <name>")
  .description("Fetch a server definition from the catalog and add it to the local registry")
  .option("--refresh", "Bypass the local cache and re-fetch the catalog")
  .action(async (name: string, opts: { refresh?: boolean }) => {
    try {
      const catalog = await fetchCatalog(undefined, opts.refresh);
      const entry = getCatalogEntry(catalog, name);
      if (!entry) {
        console.error(`Server '${name}' not found in catalog. Run: mcp-proj catalog search <query>`);
        process.exit(1);
      }
      const installed = addEntry({
        name: entry.name,
        command: entry.command,
        args: entry.args,
        env: entry.env,
      });
      console.log(`Installed '${installed.name}' (${installed.installedAt})`);
    } catch (err) {
      console.error("Install error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

catalogCommand
  .command("list")
  .description("List all servers in the catalog")
  .option("--refresh", "Bypass the local cache and re-fetch the catalog")
  .action(async (opts: { refresh?: boolean }) => {
    try {
      const catalog = await fetchCatalog(undefined, opts.refresh);
      for (const s of catalog.servers) {
        console.log(`  ${s.name.padEnd(24)} ${s.description ?? ""}`);
      }
      console.log(`\n${catalog.servers.length} server(s) in catalog.`);
    } catch (err) {
      console.error("Catalog error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
