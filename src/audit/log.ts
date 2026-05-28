import { appendFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

export type AuditEntry = {
  timestamp: string;
  projectionName: string;
  kind: string;
  server: string;
  tool: string;
  params: Record<string, unknown>;
  response: unknown[];
  durationMs: number;
  isError?: boolean;
};

function logPath(): string {
  return path.join(homedir(), ".mcp-projection", "audit.log");
}

function ensureDir(p: string): void {
  mkdirSync(path.dirname(p), { recursive: true });
}

export function appendAuditEntry(entry: AuditEntry): void {
  const p = logPath();
  ensureDir(p);
  appendFileSync(p, JSON.stringify(entry) + "\n", "utf8");
}

export async function* tailAuditLog(n = 50): AsyncGenerator<AuditEntry> {
  const p = logPath();
  if (!existsSync(p)) return;

  const lines: string[] = [];
  const rl = createInterface({ input: createReadStream(p), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }

  for (const line of lines.slice(-n)) {
    try {
      yield JSON.parse(line) as AuditEntry;
    } catch {
      // skip malformed lines
    }
  }
}
