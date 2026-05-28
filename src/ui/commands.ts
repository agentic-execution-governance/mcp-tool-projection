import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uiCommand = new Command("ui")
  .description("Start the projection profile authoring tool in a browser")
  .option("-p, --port <number>", "Port to listen on", "3847")
  .action(async (opts: { port: string }) => {
    const port = parseInt(opts.port, 10);

    // dist/ui is relative to this file's compiled location (dist/ui/commands.js → dist/ui/)
    const uiDist = path.resolve(__dirname, "..", "ui-app");

    if (!existsSync(path.join(uiDist, "index.html"))) {
      console.error("UI not built. Run: npm run build:ui\n" + "Or for development: npm run dev:ui");
      process.exit(1);
    }

    const { serveUi } = await import("./api.js");
    await serveUi(port, uiDist);

    const url = `http://localhost:${port}`;
    console.log(`Projection authoring tool running at ${url}`);

    const { default: open } = await import("open");
    await open(url);
  });
