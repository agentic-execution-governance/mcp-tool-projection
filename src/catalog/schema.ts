import { z } from "zod";

export const CatalogEntrySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).default([]),
  homepage: z.string().optional(),
});

export const CatalogSchema = z.object({
  version: z.number().default(1),
  servers: z.array(CatalogEntrySchema),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
