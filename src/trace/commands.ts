import { Command } from "commander";
import {
  compareTraceSummaries,
  summarizeTraceFile,
  type TraceComparison,
  type TraceSummary,
} from "./summarize.js";

export const traceCommand = new Command("trace").description("Inspect JSONL trace files");

traceCommand
  .command("summarize <trace-file> [projected-trace-file]")
  .description("Summarize one trace, or compare a baseline trace against a projected trace")
  .option("--format <format>", "Output format: table or json", "table")
  .action(
    async (
      traceFile: string,
      projectedTraceFile: string | undefined,
      options: { format: string },
    ) => {
      try {
        const baseline = await summarizeTraceFile(
          traceFile,
          projectedTraceFile ? "baseline" : undefined,
        );

        if (!projectedTraceFile) {
          if (options.format === "json") {
            console.log(JSON.stringify(baseline, null, 2));
            return;
          }
          ensureTableFormat(options.format);
          printSingleSummary(baseline);
          return;
        }

        const projected = await summarizeTraceFile(projectedTraceFile, "projected");
        const comparison = compareTraceSummaries(baseline, projected);

        if (options.format === "json") {
          console.log(JSON.stringify(comparison, null, 2));
          return;
        }
        ensureTableFormat(options.format);
        printComparison(comparison);
      } catch (err) {
        console.error("Error summarizing trace:", err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );

function ensureTableFormat(format: string): void {
  if (format !== "table") {
    throw new Error(`Unsupported format '${format}'. Use table or json.`);
  }
}

function printSingleSummary(summary: TraceSummary): void {
  console.log("| Metric | Value |");
  console.log("| --- | ---: |");
  for (const [metric, value] of summaryRows(summary)) {
    console.log(`| ${metric} | ${formatValue(value)} |`);
  }
}

function printComparison(comparison: TraceComparison): void {
  console.log("| Metric | Baseline | Projected | Delta |");
  console.log("| --- | ---: | ---: | ---: |");

  for (const [metric, baseline, projected] of comparisonRows(comparison)) {
    console.log(
      `| ${metric} | ${formatValue(baseline)} | ${formatValue(projected)} | ${formatDelta(projected, baseline)} |`,
    );
  }

  console.log(
    `| schema_token_reduction | ${formatValue(comparison.baseline.estimated_schema_tokens)} | ${formatValue(
      comparison.projected.estimated_schema_tokens,
    )} | ${formatSigned(comparison.schema_token_reduction)}${
      comparison.schema_token_reduction_percent === null
        ? ""
        : ` (${formatSigned(comparison.schema_token_reduction_percent)}%)`
    } |`,
  );
  console.log(
    `| latency_delta_ms | ${formatValue(comparison.baseline.total_latency_ms)} | ${formatValue(
      comparison.projected.total_latency_ms,
    )} | ${formatSigned(comparison.latency_delta_ms)} |`,
  );
}

function summaryRows(summary: TraceSummary): Array<[string, number | null]> {
  return [
    ["tools_list_calls", summary.tools_list_calls],
    ["total_exposed_tools", summary.total_exposed_tools],
    ["total_schema_bytes", summary.total_schema_bytes],
    ["estimated_schema_tokens", summary.estimated_schema_tokens],
    ["actual_tools_called", summary.actual_tools_called],
    ["unused_tools_exposed", summary.unused_tools_exposed],
    ["exposed_to_used_ratio", summary.exposed_to_used_ratio],
    ["total_latency_ms", summary.total_latency_ms],
  ];
}

function comparisonRows(
  comparison: TraceComparison,
): Array<[string, number | null, number | null]> {
  return summaryRows(comparison.baseline)
    .filter(([metric]) => metric !== "total_latency_ms")
    .map(([metric, baseline]) => [
      metric,
      baseline,
      comparison.projected[metric as keyof TraceSummary] as number | null,
    ]);
}

function formatValue(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function formatDelta(value: number | null, baseline: number | null): string {
  if (value === null || baseline === null) return "n/a";
  return formatSigned(value - baseline);
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
