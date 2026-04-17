#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";
import { VentrataClient } from "./client.js";
import { registerProductTools } from "./tools/products.js";
import { registerAvailabilityTools } from "./tools/availability.js";
import { registerBookingTools } from "./tools/bookings.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerLoggingTools } from "./tools/logging.js";

const server = new McpServer(
  { name: "ventrata-mcp", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

const client = new VentrataClient();
client.logFn = async (level, data) => {
  await server.sendLoggingMessage({ level: level as LoggingLevel, logger: "ventrata-mcp", data });
};

registerProductTools(server, client);
registerAvailabilityTools(server, client);
registerBookingTools(server, client);
registerOrderTools(server, client);
registerDiscoveryTools(server, client);
registerLoggingTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ventrata-mcp] Server running on stdio");
  if (process.env.VENTRATA_DEBUG === "true") {
    console.error(`[ventrata-mcp] Debug log file: ${client.getLogFile()}`);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
