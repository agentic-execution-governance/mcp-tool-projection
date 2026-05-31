#!/usr/bin/env tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

type DemoTool = {
  name: string;
  description: string;
  inputSchema: object;
};

const commonString = (description: string) => ({ type: "string", description });

const groups: Record<string, DemoTool[]> = {
  search: [
    tool("search_web", "Search public web results", ["query", "safesearch"]),
    tool("search_news", "Search recent news results", ["query", "region"]),
    tool("search_images", "Search image results", ["query", "license"]),
    tool("search_videos", "Search video results", ["query", "duration"]),
    tool("search_academic", "Search academic papers", ["query", "field"]),
    tool("search_local", "Search local business results", ["query", "location"]),
    tool("search_social", "Search public social posts", ["query", "network"]),
    tool("search_patents", "Search patent filings", ["query", "jurisdiction"]),
    tool("search_packages", "Search package registries", ["query", "ecosystem"]),
    tool("search_vulnerabilities", "Search vulnerability databases", ["query", "severity"]),
  ],
  repo: [
    tool("repo_read_file", "Read a repository file", ["path", "root"]),
    tool("repo_search_code", "Search repository code", ["query", "language"]),
    tool("repo_list_files", "List files in a directory", ["path", "glob"]),
    tool("repo_get_diff", "Read the working tree diff", ["base", "head"]),
    tool("repo_blame", "Read file blame metadata", ["path", "line"]),
    tool("repo_write_file", "Write a repository file", ["path", "content"]),
    tool("repo_delete_file", "Delete a repository file", ["path", "reason"]),
    tool("repo_run_tests", "Run a test command", ["command", "timeout"]),
    tool("repo_format", "Format source files", ["paths", "check"]),
    tool("repo_open_workspace", "Open repository metadata", ["path", "includeIgnored"]),
  ],
  github: [
    tool("github_create_pull_request", "Create a pull request", ["title", "body", "base"]),
    tool("github_list_issues", "List repository issues", ["repo", "state"]),
    tool("github_comment_issue", "Comment on an issue", ["issue", "body"]),
    tool("github_merge_pull_request", "Merge a pull request", ["pullRequest", "method"]),
    tool("github_close_issue", "Close an issue", ["issue", "reason"]),
    tool("github_request_review", "Request a pull request review", ["pullRequest", "reviewer"]),
    tool("github_list_checks", "List pull request checks", ["pullRequest", "status"]),
    tool("github_create_branch", "Create a branch", ["name", "from"]),
    tool("github_push_commit", "Push a commit", ["branch", "message"]),
    tool("github_read_file", "Read a file through GitHub", ["path", "ref"]),
  ],
  comms: [
    tool("slack_post_message", "Post a Slack message", ["channel", "text"]),
    tool("slack_read_thread", "Read a Slack thread", ["channel", "thread"]),
    tool("email_send", "Send an email", ["to", "subject"]),
    tool("email_search", "Search email", ["query", "label"]),
    tool("calendar_create_event", "Create a calendar event", ["title", "time"]),
    tool("calendar_list_events", "List calendar events", ["date", "calendar"]),
    tool("notion_create_page", "Create a Notion page", ["parent", "title"]),
    tool("notion_search", "Search Notion", ["query", "space"]),
    tool("docs_create", "Create a document", ["title", "folder"]),
    tool("docs_comment", "Comment on a document", ["document", "comment"]),
  ],
};

const group = process.argv[2] ?? "search";
const tools = groups[group];

if (!tools) {
  throw new Error(`Unknown surface-server group '${group}'`);
}

const server = new Server(
  { name: `surface-${group}`, version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => ({
  content: [
    {
      type: "text",
      text: JSON.stringify({ tool: req.params.name, arguments: req.params.arguments ?? {} }),
    },
  ],
}));

await server.connect(new StdioServerTransport());

function tool(name: string, description: string, required: string[]): DemoTool {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        required.map((key) => [key, commonString(`${key} parameter`)]),
      ),
      required,
    },
  };
}
