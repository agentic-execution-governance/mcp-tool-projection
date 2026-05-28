import { Command } from "commander";
import { loadProjection, listProjections } from "./loader.js";
import { runProjection, AbsentToolError } from "./engine.js";

export const projectionCommand = new Command("projection").description(
  "Run and manage tool projections",
);

projectionCommand
  .command("run <definition-file> [params-json]")
  .description("Execute a projection (all kinds: partial, simulated, verbatim, absent)")
  .action(async (definitionFile: string, paramsJson?: string) => {
    const projection = loadProjection(definitionFile);
    const params = paramsJson ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};

    try {
      const result = await runProjection(projection, params);

      if (result.isError) {
        console.error("Tool returned an error:");
        console.error(JSON.stringify(result.content, null, 2));
        process.exit(1);
      }

      console.log(JSON.stringify(result.content, null, 2));
    } catch (err) {
      if (err instanceof AbsentToolError) {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }
  });

projectionCommand
  .command("list <dir>")
  .description("List all projection definitions in a directory")
  .option("--json", "Output raw JSON")
  .action((dir: string, opts: { json?: boolean }) => {
    const projections = listProjections(dir);

    if (opts.json) {
      console.log(JSON.stringify(projections, null, 2));
      return;
    }

    if (projections.length === 0) {
      console.log("No projection files found.");
      return;
    }

    for (const p of projections) {
      console.log(`  ${p.name}  [${p.kind}]  ${p.server}/${p.tool}`);
      if (p.description) console.log(`    ${p.description}`);
    }
  });
