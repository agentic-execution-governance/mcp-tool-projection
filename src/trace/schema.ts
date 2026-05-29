import { z } from "zod";

const base = z.object({
  timestamp: z.string().datetime(),
  event_type: z.enum(["tools_list", "tools_call"]),
  // Registry name or profile name; null when the server is addressed by file path.
  profile: z.string().nullable(),
  latency_ms: z.number().int().nonnegative(),
});

export const ToolsListEventSchema = base.extend({
  event_type: z.literal("tools_list"),
  // Total byte size of all tool schemas returned by this tools/list call.
  schema_bytes: z.number().int().nonnegative(),
});

export const ToolsCallEventSchema = base.extend({
  event_type: z.literal("tools_call"),
  tool_name: z.string(),
  // Byte size of this tool's schema as returned by tools/list.
  schema_bytes: z.number().int().nonnegative(),
  // Byte size of the JSON-serialised response content array.
  result_bytes: z.number().int().nonnegative(),
});

export const TraceEventSchema = z.discriminatedUnion("event_type", [
  ToolsListEventSchema,
  ToolsCallEventSchema,
]);

export type ToolsListEvent = z.infer<typeof ToolsListEventSchema>;
export type ToolsCallEvent = z.infer<typeof ToolsCallEventSchema>;
export type TraceEvent = z.infer<typeof TraceEventSchema>;
