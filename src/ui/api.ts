import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readRegistry } from "../registry/store.js";
import { listTools } from "../server/client.js";
import { applyProjectionToTool } from "../proxy/router.js";
import { CollisionStrategySchema } from "../profile/schema.js";
import { resolveProfile } from "../profile/resolver.js";
import type { Projection } from "../projection/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loose schema for the UI draft — projections don't have `name` or `server` (inherited from upstream)
const UiProjectionSchema = z.object({
  tool: z.string(),
  kind: z.enum(["partial", "simulated", "verbatim", "absent"]),
  projectedName: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  response: z.string().optional(), // JSON-encoded content array
});
const DraftServerSchema = z.object({
  upstream: z.string(),
  projections: z.array(UiProjectionSchema).default([]),
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
    // Convert UI draft projections to full Projection objects (add name + server fields)
    const resolvedProfile = {
      name: parsed.data.name,
      description: parsed.data.description,
      collision: parsed.data.collision,
      servers: parsed.data.servers.map((s) => ({
        upstream: s.upstream,
        projections: s.projections.map((p): Projection => {
          const base = { name: p.projectedName ?? p.tool, server: s.upstream, tool: p.tool, projectedName: p.projectedName };
          if (p.kind === "absent") return { ...base, kind: "absent" };
          if (p.kind === "verbatim") return { ...base, kind: "verbatim" };
          if (p.kind === "partial") return { ...base, kind: "partial", params: p.params ?? {}, readonly: false };
          // simulated
          let response: unknown[] = [{ type: "text", text: "(simulated)" }];
          if (p.response) { try { response = JSON.parse(p.response) as unknown[]; } catch { /* keep default */ } }
          return { ...base, kind: "simulated", response };
        }),
      })),
    };

    try {
      const collision = resolvedProfile.collision;
      const slots = resolveProfile(resolvedProfile);

      type Candidate = { server: string; tool: string; exposedName: string; kind: string; fixedParams?: Record<string, unknown>; projectedName?: string };
      const candidates: Candidate[] = [];

      for (const slot of slots) {
        const tools = await listTools(slot.config);
        for (const tool of tools) {
          const proj = slot.projectionSet.get(tool.name);
          if (proj?.kind === "absent") continue;
          const applied = proj ? applyProjectionToTool(tool, proj) : tool;
          candidates.push({
            server: slot.config.name,
            tool: tool.name,
            exposedName: applied.name,
            kind: proj?.kind ?? "verbatim",
            fixedParams: proj?.kind === "partial" && Object.keys(proj.params).length ? (proj.params as Record<string, unknown>) : undefined,
            projectedName: proj?.projectedName,
          });
        }
      }

      // Find which exposed names are claimed by more than one server
      const seen = new Map<string, string>();
      const conflicts = new Set<string>();
      for (const c of candidates) {
        if (seen.has(c.exposedName)) conflicts.add(c.exposedName);
        else seen.set(c.exposedName, c.server);
      }

      // Apply collision strategy
      const effective: Candidate[] = [];
      const collisions: string[] = [];
      const firstSeen = new Set<string>();

      for (const c of candidates) {
        if (!conflicts.has(c.exposedName)) {
          effective.push(c);
          continue;
        }
        if (collision === "error") {
          effective.push(c); // show all, flag as collision
          if (!collisions.includes(c.exposedName)) collisions.push(c.exposedName);
        } else if (collision === "prefix") {
          effective.push({ ...c, exposedName: `${c.server}__${c.exposedName}` });
        } else {
          // first: keep only the first server's version
          if (!firstSeen.has(c.exposedName)) {
            firstSeen.add(c.exposedName);
            effective.push(c);
          }
        }
      }

      res.json({ effective, collisions });
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
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(uiDist, "index.html"));
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => resolve());
  });
}
