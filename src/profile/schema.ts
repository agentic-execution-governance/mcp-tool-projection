import { z } from "zod";

const inlineBase = {
  name: z.string(),
  tool: z.string(),
  description: z.string().optional(),
};

const InlineVerbatimSchema = z.object({ ...inlineBase, kind: z.literal("verbatim") });
const InlinePartialSchema = z.object({
  ...inlineBase,
  kind: z.literal("partial"),
  params: z.record(z.string(), z.unknown()),
});
const InlineSimulatedSchema = z.object({
  ...inlineBase,
  kind: z.literal("simulated"),
  response: z.array(z.unknown()),
});
const InlineAbsentSchema = z.object({ ...inlineBase, kind: z.literal("absent") });

// Inline projection: same shape as a Projection but `server` is omitted
// (inherited from the enclosing ProfileServerEntry.upstream)
export const InlineProjectionSchema = z.discriminatedUnion("kind", [
  InlineVerbatimSchema,
  InlinePartialSchema,
  InlineSimulatedSchema,
  InlineAbsentSchema,
]);
export type InlineProjection = z.infer<typeof InlineProjectionSchema>;

export const FileRefSchema = z.object({ file: z.string() });
export type FileRef = z.infer<typeof FileRefSchema>;

// A projection entry is either a file reference or an inline projection
export const ProjectionEntrySchema = z.union([FileRefSchema, InlineProjectionSchema]);
export type ProjectionEntry = z.infer<typeof ProjectionEntrySchema>;

export const ProfileServerEntrySchema = z.object({
  upstream: z.string(),
  projections: z.array(ProjectionEntrySchema).default([]),
});
export type ProfileServerEntry = z.infer<typeof ProfileServerEntrySchema>;

export const CollisionStrategySchema = z.enum(["error", "prefix", "first"]).default("error");
export type CollisionStrategy = z.infer<typeof CollisionStrategySchema>;

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  collision: CollisionStrategySchema,
  servers: z.array(ProfileServerEntrySchema).min(1),
});
export type Profile = z.infer<typeof ProfileSchema>;
