import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError, safePathSegment } from "../client.js";
import { sanitizeOrder } from "../sanitize.js";
import type { VentrataOrder } from "../types.js";

export function registerOrderTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "get_order",
    {
      title: "Get Order",
      description:
        "Retrieve order details by order ID. Returns a curated allowlist of order fields including nested sanitized bookings, pricing, and status. Contact details and any fields not explicitly whitelisted are dropped — see src/sanitize.ts for the full list.",
      inputSchema: z.object({
        orderId: z.string().describe("The order ID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ orderId }) => handleToolError(async () => {
      const order = await client.get<VentrataOrder>(`/orders/${safePathSegment(orderId)}`);
      const sanitized = sanitizeOrder(order as unknown as Record<string, unknown>);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(sanitized, null, 2) }],
      };
    })
  );
}
