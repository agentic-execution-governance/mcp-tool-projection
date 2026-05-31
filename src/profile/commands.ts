import { Command } from "commander";
import { resolve } from "node:path";
import { loadProfile } from "./loader.js";
import { measureProfile, measurementToTraceEvent, type ProfileMeasurement } from "./measure.js";
import { appendTraceEvent } from "../trace/writer.js";

export const profileCommand = new Command("profile").description(
  "Inspect and validate profile files",
);

profileCommand
  .command("validate <profile-file>")
  .description("Parse a profile file, resolve all file references, and report any errors")
  .action((profileFile: string) => {
    try {
      const profile = loadProfile(resolve(profileFile));
      const serverCount = profile.servers.length;
      const projCount = profile.servers.reduce((n, s) => n + s.projections.length, 0);
      console.log(`Profile '${profile.name}' is valid.`);
      console.log(
        `  Servers: ${serverCount}, Projections: ${projCount}, Collision: ${profile.collision}`,
      );
    } catch (err) {
      console.error("Invalid profile:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

profileCommand
  .command("list <profile-file>")
  .description("Print the declared tool surface for a profile (server → tool → kind)")
  .action((profileFile: string) => {
    try {
      const profile = loadProfile(resolve(profileFile));
      console.log(`Profile: ${profile.name}`);
      if (profile.description) console.log(`  ${profile.description}`);
      console.log(`  Collision: ${profile.collision}`);
      console.log();

      for (const server of profile.servers) {
        console.log(`  upstream: ${server.upstream}`);
        if (server.projections.length === 0) {
          console.log("    (no projections — all tools pass through verbatim)");
        } else {
          const nameWidth = Math.max(...server.projections.map((p) => p.name.length), 4);
          const kindWidth = Math.max(...server.projections.map((p) => p.kind.length), 4);
          for (const proj of server.projections) {
            console.log(
              `    ${proj.name.padEnd(nameWidth)}  ${proj.kind.padEnd(kindWidth)}  ${proj.tool}`,
            );
          }
        }
        console.log();
      }
    } catch (err) {
      console.error("Error reading profile:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

profileCommand
  .command("measure <profile-file>")
  .description("Measure the exposed tool surface for a profile")
  .option("--format <format>", "Output format: table or json", "table")
  .option("--trace <path>", "Append a tools_list event to a JSONL trace file")
  .action(async (profileFile: string, options: { format: string; trace?: string }) => {
    try {
      const profile = loadProfile(resolve(profileFile));
      const measurement = await measureProfile(profile);

      if (options.trace) {
        appendTraceEvent(resolve(options.trace), measurementToTraceEvent(measurement));
      }

      if (options.format === "json") {
        console.log(JSON.stringify(withoutTools(measurement), null, 2));
        return;
      }

      if (options.format !== "table") {
        throw new Error(`Unsupported format '${options.format}'. Use table or json.`);
      }

      printMeasurementTable(measurement);
    } catch (err) {
      console.error("Error measuring profile:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

function withoutTools(measurement: ProfileMeasurement): Omit<ProfileMeasurement, "tools"> {
  return {
    profile: measurement.profile,
    total_exposed_tools: measurement.total_exposed_tools,
    total_schema_bytes: measurement.total_schema_bytes,
    estimated_schema_tokens: measurement.estimated_schema_tokens,
    result_bytes: measurement.result_bytes,
    latency_ms: measurement.latency_ms,
  };
}

function printMeasurementTable(measurement: ProfileMeasurement): void {
  console.log(`Profile: ${measurement.profile}`);
  console.log();
  console.log("| Metric | Value |");
  console.log("| --- | ---: |");
  console.log(`| total_exposed_tools | ${measurement.total_exposed_tools} |`);
  console.log(`| total_schema_bytes | ${measurement.total_schema_bytes} |`);
  console.log(`| estimated_schema_tokens | ${measurement.estimated_schema_tokens} |`);
  console.log(`| result_bytes | ${measurement.result_bytes} |`);
  console.log(`| latency_ms | ${measurement.latency_ms} |`);
}
