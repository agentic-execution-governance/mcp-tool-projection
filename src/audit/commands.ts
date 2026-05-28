import { Command } from "commander";
import { tailAuditLog } from "./log.js";

export const auditCommand = new Command("audit").description("Inspect the projection audit log");

auditCommand
  .command("tail")
  .description("Print the last N audit log entries")
  .option("-n, --lines <number>", "Number of lines to show", "50")
  .action(async (opts: { lines: string }) => {
    const n = parseInt(opts.lines, 10);
    let count = 0;
    for await (const entry of tailAuditLog(n)) {
      const status = entry.isError ? "ERR" : "OK ";
      const ts = new Date(entry.timestamp).toISOString().replace("T", " ").slice(0, 19);
      console.log(
        `${ts}  ${status}  ${entry.kind.padEnd(9)}  ${entry.server}/${entry.tool}` +
          (entry.projectionName !== entry.tool ? `  (${entry.projectionName})` : "") +
          `  ${entry.durationMs}ms`,
      );
      count++;
    }
    if (count === 0) console.log("(audit log is empty)");
  });
