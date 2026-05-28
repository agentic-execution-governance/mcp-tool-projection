import { z } from "zod";

const ResolverBaseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("inline-js"), script: z.string() }),
  z.object({ type: z.literal("script-file"), path: z.string() }),
]);

// Receives caller params, returns the final param object sent to the tool.
export const ParamResolverSchema = ResolverBaseSchema;
export type ParamResolver = z.infer<typeof ParamResolverSchema>;

// Receives caller params, returns a content array (the tool result).
export const ResultResolverSchema = ResolverBaseSchema;
export type ResultResolver = z.infer<typeof ResultResolverSchema>;
