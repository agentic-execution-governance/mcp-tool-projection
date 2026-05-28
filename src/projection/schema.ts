import { z } from "zod";
import { ParamResolverSchema, ResultResolverSchema } from "../resolvers/types.js";

// MCP tool names may not contain whitespace.
const toolName = z.string().regex(/^\S+$/, "Tool name must not contain whitespace");

const base = {
  name: z.string(),
  server: z.string(),
  tool: toolName,
  // Exposed name in tools/list. Defaults to `tool` when absent.
  projectedName: toolName.optional(),
  description: z.string().optional(),
};

export const VerbatimProjectionSchema = z.object({
  ...base,
  kind: z.literal("verbatim"),
});

export const PartialProjectionSchema = z.object({
  ...base,
  kind: z.literal("partial"),
  // params defaults to {} when a paramResolver is used instead
  params: z.record(z.string(), z.unknown()).default({}),
  // When present, receives caller params and returns the final merged param object.
  // Resolver output replaces the static params merge entirely.
  paramResolver: ParamResolverSchema.optional(),
  // When true, the caller may not supply any params not listed in `params`.
  readonly: z.boolean().default(false),
});

export const SimulatedProjectionSchema = z
  .object({
    ...base,
    kind: z.literal("simulated"),
    // Static canned response; required when resultResolver is absent.
    response: z.array(z.unknown()).optional(),
    // When present, called instead of returning the static response.
    resultResolver: ResultResolverSchema.optional(),
  })
  .refine((v) => v.response !== undefined || v.resultResolver !== undefined, {
    message: "A simulated projection requires either 'response' or 'resultResolver'",
  });

export const AbsentProjectionSchema = z.object({
  ...base,
  kind: z.literal("absent"),
});

export const ProjectionSchema = z.discriminatedUnion("kind", [
  VerbatimProjectionSchema,
  PartialProjectionSchema,
  SimulatedProjectionSchema,
  AbsentProjectionSchema,
]);

export type Projection = z.infer<typeof ProjectionSchema>;
export type ProjectionKind = Projection["kind"];
