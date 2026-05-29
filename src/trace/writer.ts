import { appendFileSync, mkdirSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { TraceEvent, TraceEventSchema } from "./schema.js";

export function appendTraceEvent(filePath: string, event: TraceEvent): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
}

export async function* readTraceFile(filePath: string): AsyncGenerator<TraceEvent> {
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = TraceEventSchema.safeParse(JSON.parse(line));
    if (parsed.success) yield parsed.data;
  }
}
