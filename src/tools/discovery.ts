import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError } from "../client.js";

export function registerDiscoveryTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "list_capabilities",
    {
      title: "List Capabilities",
      description:
        "List all OCTO capabilities supported by the supplier. Capabilities include: octo/pricing, octo/content, octo/questions, octo/cardPayments, octo/offers, octo/cart.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (_input) => handleToolError(async () => {
      const data = await client.get<unknown>("/capabilities");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    })
  );

  server.registerTool(
    "whoami",
    {
      title: "Who Am I",
      description:
        "Get the authenticated supplier/connection context. Returns supplier ID, name, and connection details. Useful for verifying API key validity.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (_input) => handleToolError(async () => {
      const data = await client.get<unknown>("/whoami");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    })
  );
}
