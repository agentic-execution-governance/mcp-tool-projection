import { Command } from "commander";
import { resolve } from "node:path";
import { loadProfile } from "./loader.js";

export const profileCommand = new Command("profile")
  .description("Inspect and validate profile files");

profileCommand
  .command("validate <profile-file>")
  .description("Parse a profile file, resolve all file references, and report any errors")
  .action((profileFile: string) => {
    try {
      const profile = loadProfile(resolve(profileFile));
      const serverCount = profile.servers.length;
      const projCount = profile.servers.reduce((n, s) => n + s.projections.length, 0);
      console.log(`Profile '${profile.name}' is valid.`);
      console.log(`  Servers: ${serverCount}, Projections: ${projCount}, Collision: ${profile.collision}`);
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
