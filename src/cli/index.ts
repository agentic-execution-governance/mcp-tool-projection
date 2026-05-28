#!/usr/bin/env node
import { program } from "commander";
import { toolsCommand } from "../server/commands.js";
import { registryCommand } from "../registry/commands.js";
import { projectionCommand } from "../projection/commands.js";

program
  .name("mcp-proj")
  .description("Declarative tool projections over arbitrary MCP servers")
  .version("0.1.0");

program.addCommand(toolsCommand);
program.addCommand(registryCommand);
program.addCommand(projectionCommand);
// program.addCommand(catalogCommand)    // Phase 4

program.parse();
