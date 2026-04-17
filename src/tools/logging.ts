import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError } from "../client.js";

export function registerLoggingTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "get_log_path",
    {
      title: "Get Log Path",
      description: "Return the effective ventrata-mcp debug log file path.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (_input) => handleToolError(async () => ({
      content: [{ type: "text" as const, text: client.getLogFile() }],
    }))
  );
}
