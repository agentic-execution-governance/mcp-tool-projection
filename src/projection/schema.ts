import { z } from "zod";

const base = {
  name: z.string(),
  server: z.string(),
  tool: z.string(),
  description: z.string().optional(),
};

export const VerbatimProjectionSchema = z.object({
  ...base,
  kind: z.literal("verbatim"),
});

export const PartialProjectionSchema = z.object({
  ...base,
  kind: z.literal("partial"),
  params: z.record(z.string(), z.unknown()),
});

export const SimulatedProjectionSchema = z.object({
  ...base,
  kind: z.literal("simulated"),
  response: z.array(z.unknown()),
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
