import { describe, expect, it } from "vitest";
import {
  byteLength,
  estimateTokens,
  estimateToolSchemaTokens,
  toolSchemaBytes,
} from "./tokenEstimator.js";

describe("estimateTokens", () => {
  it("returns 0 for an empty schema string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates nested object schemas", () => {
    const schema = {
      type: "object",
      properties: {
        repo: { type: "string" },
        pullRequest: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["title"],
        },
      },
    };

    expect(estimateTokens(schema)).toBeGreaterThan(20);
    expect(byteLength(schema)).toBe(Buffer.byteLength(JSON.stringify(schema), "utf8"));
  });

  it("scales for large array enums", () => {
    const small = { enum: ["a", "b"] };
    const large = { enum: Array.from({ length: 200 }, (_, i) => `option-${i}`) };

    expect(estimateTokens(large)).toBeGreaterThan(estimateTokens(small));
  });
});

describe("tool schema helpers", () => {
  it("sums schema bytes and token estimates per tool", () => {
    const tools = [
      { name: "read_file", inputSchema: { type: "object" } },
      { name: "create_pull_request", inputSchema: { type: "object", properties: {} } },
    ];

    expect(toolSchemaBytes(tools)).toBe(
      tools.reduce((total, tool) => total + Buffer.byteLength(JSON.stringify(tool), "utf8"), 0),
    );
    expect(estimateToolSchemaTokens(tools)).toBe(
      tools.reduce((total, tool) => total + estimateTokens(tool), 0),
    );
  });
});
