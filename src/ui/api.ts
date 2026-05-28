import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readRegistry } from "../registry/store.js";
import { listTools } from "../server/client.js";
import { applyProjectionToTool, loadProjectionSet } from "../proxy/router.js";
import { CollisionStrategySchema } from "../profile/schema.js";
import { resolveProfile } from "../profile/resolver.js";
import { ProjectionSchema } from "../projection/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loose schema for the profile draft coming from the UI (projections may be incomplete)
const DraftServerSchema = z.object({
  upstream: z.string(),
  projections: z.array(ProjectionSchema).default([]),
});
const ProfileDraftSchema = z.object({
  name: z.string().default("draft"),
  description: z.string().optional(),
  collision: CollisionStrategySchema,
  servers: z.array(DraftServerSchema).default([]),
});

export function createApiApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Registered servers
  app.get("/api/servers", (_req: Request, res: Response) => {
    const registry = readRegistry();
    res.json({ servers: Object.values(registry) });
  });

  // Tools for a registered server
  app.get("/api/tools/:serverName", async (req: Request, res: Response) => {
    const entry = readRegistry()[req.params["serverName"] as string];
    if (!entry) {
      res.status(404).json({ error: `Server '${req.params.serverName}' not found in registry` });
      return;
    }
    try {
      const tools = await listTools(entry);
      res.json({ tools });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Compute effective tool surface from a profile draft
  app.post("/api/profile/preview", async (req: Request, res: Response) => {
    const parsed = ProfileDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = {
      name: parsed.data.name,
      description: parsed.data.description,
      collision: parsed.data.collision,
      servers: parsed.data.servers.map((s) => ({
        upstream: s.upstream,
        projections: s.projections,
      })),
    };

    try {
      const slots = resolveProfile(profile);
      const effective: Array<{
        server: string;
        tool: string;
        exposedName: string;
        kind: string;
        fixedParams?: Record<string, unknown>;
        projectedName?: string;
      }> = [];

      for (const slot of slots) {
        const tools = await listTools(slot.config);
        for (const tool of tools) {
          const proj = slot.projectionSet.get(tool.name);
          if (proj?.kind === "absent") continue;
          const applied = proj ? applyProjectionToTool(tool, proj) : tool;
          effective.push({
            server: slot.config.name,
            tool: tool.name,
            exposedName: applied.name,
            kind: proj?.kind ?? "verbatim",
            fixedParams:
              proj?.kind === "partial" && Object.keys(proj.params).length
                ? (proj.params as Record<string, unknown>)
                : undefined,
            projectedName: proj?.projectedName,
          });
        }
      }

      // Detect collisions
      const seen = new Map<string, string>();
      const collisions = new Set<string>();
      for (const t of effective) {
        if (seen.has(t.exposedName)) collisions.add(t.exposedName);
        else seen.set(t.exposedName, t.server);
      }

      res.json({ effective, collisions: [...collisions] });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}

export function serveUi(port: number, uiDist: string) {
  const app = createApiApp();

  // Serve the built React SPA
  app.use(express.static(uiDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(uiDist, "index.html"));
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => resolve());
  });
}
