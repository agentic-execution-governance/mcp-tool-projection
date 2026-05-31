import { appendFileSync, mkdirSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { TraceEvent, TraceEventSchema } from "./schema.js";

export function appendTraceEvent(filePath: string, event: TraceEvent): void {
  const validated = TraceEventSchema.parse(event);
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, JSON.stringify(validated) + "\n", "utf8");
}

export async function* readTraceFile(filePath: string): AsyncGenerator<TraceEvent> {
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const parsed = TraceEventSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      throw new Error(`Invalid trace record at ${filePath}:${lineNumber}: ${parsed.error.message}`);
    }
    yield parsed.data;
  }
}
