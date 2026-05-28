#!/usr/bin/env node
import { program } from "commander";

program
  .name("mcp-proj")
  .description("Declarative tool projections over arbitrary MCP servers")
  .version("0.1.0");

// Sub-command groups are registered here as they are implemented:
//   program.addCommand(registryCommand)   // Phase 2
//   program.addCommand(toolsCommand)      // Phase 1
//   program.addCommand(projectionCommand) // Phase 3
//   program.addCommand(catalogCommand)    // Phase 4

program.parse();
