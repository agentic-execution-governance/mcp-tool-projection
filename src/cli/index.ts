#!/usr/bin/env node
import { program } from "commander";
import { toolsCommand } from "../server/commands.js";
import { registryCommand } from "../registry/commands.js";
import { projectionCommand } from "../projection/commands.js";
import { serveCommand } from "../proxy/commands.js";
import { profileCommand } from "../profile/commands.js";
import { catalogCommand } from "../catalog/commands.js";
import { auditCommand } from "../audit/commands.js";
import { uiCommand } from "../ui/commands.js";

program
  .name("mcp-proj")
  .description("Declarative tool projections over arbitrary MCP servers")
  .version("0.1.0");

program.addCommand(toolsCommand);
program.addCommand(registryCommand);
program.addCommand(projectionCommand);
program.addCommand(serveCommand);
program.addCommand(profileCommand);
program.addCommand(catalogCommand);
program.addCommand(auditCommand);
program.addCommand(uiCommand);

program.parse();
