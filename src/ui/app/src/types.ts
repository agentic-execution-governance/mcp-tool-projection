export type RegistryEntry = {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  installedAt: string;
};

export type ToolInfo = {
  name: string;
  description?: string;
  inputSchema: object;
};

export type ProjectionKind = "partial" | "simulated" | "verbatim" | "absent";

export type ProjectionDraft = {
  id: string; // local UI id
  tool: string;
  kind: ProjectionKind;
  projectedName?: string;
  params?: Record<string, string>; // key → value (stored as strings, serialized properly)
  response?: string; // JSON string of content array
};

export type ServerDraft = {
  upstream: string;
  projections: ProjectionDraft[];
};

export type ProfileDraft = {
  name: string;
  description?: string;
  collision: "error" | "prefix" | "first";
  servers: ServerDraft[];
};

export type EffectiveTool = {
  server: string;
  tool: string;
  exposedName: string;
  kind: string;
  fixedParams?: Record<string, unknown>;
  projectedName?: string;
};

export type PreviewResult = {
  effective: EffectiveTool[];
  collisions: string[];
};
