import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ServerConfig } from "./config.js";

export type ToolInfo = {
  name: string;
  description?: string;
  inputSchema: object;
};

export type CallResult = {
  content: unknown[];
  isError?: boolean;
};

export async function withMcpClient<T>(
  config: ServerConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
  });

  const client = new Client({ name: "mcp-proj", version: "0.1.0" });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function listTools(config: ServerConfig): Promise<ToolInfo[]> {
  return withMcpClient(config, async (client) => {
    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as object,
    }));
  });
}

export async function callTool(
  config: ServerConfig,
  toolName: string,
  params: Record<string, unknown>,
): Promise<CallResult> {
  return withMcpClient(config, async (client) => {
    const result = await client.callTool({ name: toolName, arguments: params });
    return {
      content: result.content as unknown[],
      isError: result.isError === true,
    };
  });
}
