import { Command } from "commander";
import { resolve } from "node:path";
import { loadServerConfig } from "../server/config.js";
import { getEntry } from "../registry/store.js";
import { listProjections } from "../projection/loader.js";
import { loadProjectionSet, serveStdio } from "./index.js";
import { loadProfile } from "../profile/loader.js";
import { resolveProfile } from "../profile/resolver.js";
import { serveProfileStdio } from "./server.js";

export const serveCommand = new Command("serve")
  .description("Start a projection proxy in front of an upstream MCP server")
  .argument("[upstream]", "Registry name or path to a server config file")
  .argument("[projections-dir]", "Directory of projection definition files")
  .option("--profile <file>", "Profile file to use instead of upstream + projections-dir")
  .action(
    async (
      upstream: string | undefined,
      projectionsDir: string | undefined,
      options: { profile?: string },
    ) => {
      if (options.profile) {
        const profile = loadProfile(resolve(options.profile));
        const slots = resolveProfile(profile);
        process.stderr.write(
          `Profile proxy started: '${profile.name}' — ${slots.length} server(s), collision=${profile.collision}\n`,
        );
        await serveProfileStdio(slots, profile.collision);
        return;
      }

      if (!upstream || !projectionsDir) {
        console.error("Either --profile <file> or <upstream> <projections-dir> is required");
        process.exit(1);
      }

      const upstreamConfig =
        upstream.includes("/") || upstream.includes(".")
          ? loadServerConfig(upstream)
          : (() => {
              const entry = getEntry(upstream);
              if (!entry) {
                console.error(`Server '${upstream}' not found in registry`);
                process.exit(1);
              }
              return entry;
            })();

      const projections = listProjections(resolve(projectionsDir));
      const projectionSet = loadProjectionSet(projections);

      process.stderr.write(`Proxy started: ${upstream} with ${projectionSet.size} projection(s)\n`);

      await serveStdio(upstreamConfig, projectionSet);
    },
  );
