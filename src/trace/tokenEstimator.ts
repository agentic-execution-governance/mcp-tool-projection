const JSON_TOKEN_CHARS = 3.6;

export type TokenEstimateInput = string | unknown;

export function serializeForTokenEstimate(input: TokenEstimateInput): string {
  return typeof input === "string" ? input : JSON.stringify(input);
}

export function byteLength(input: TokenEstimateInput): number {
  return Buffer.byteLength(serializeForTokenEstimate(input), "utf8");
}

export function estimateTokens(input: TokenEstimateInput): number {
  const text = serializeForTokenEstimate(input);
  if (text.length === 0) return 0;

  // Reproducible heuristic for JSON-heavy MCP schemas: representative schema samples in
  // traces/examples are within about 5% of GPT-family BPE tokenizers. Keep this deliberately
  // character-based so article numbers can be reproduced without native tokenizer packages.
  return Math.max(1, Math.ceil(text.length / JSON_TOKEN_CHARS));
}

export function estimateToolSchemaTokens(tools: unknown[]): number {
  return tools.reduce<number>((total, tool) => total + estimateTokens(tool), 0);
}

export function toolSchemaBytes(tools: unknown[]): number {
  return tools.reduce<number>((total, tool) => total + byteLength(tool), 0);
}
