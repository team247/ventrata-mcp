import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError, safePathSegment } from "../client.js";
import type { VentrataProduct } from "../types.js";

export function registerProductTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "list_products",
    {
      title: "List Products",
      description:
        "List all available tour products from Ventrata. Returns a summary of each product: id, name, timezone, country, currency, and options with start times and unit types. Use this to discover products before checking availability.",
      inputSchema: z.object({
        productIds: z
          .array(z.string())
          .optional()
          .describe("Filter to specific product IDs (reduces payload size for targeted queries)"),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR') to get pricing in a specific currency"),
        categoryId: z
          .string()
          .optional()
          .describe("Filter by category ID. Use 'DEFAULT' to skip category filtering."),
        destinationId: z
          .string()
          .optional()
          .describe("Filter by destination ID (e.g. 'destination_rome'). Use 'DEFAULT' to skip."),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code or combination code for discounted pricing (requires octo/offers capability)"),
        featured: z
          .boolean()
          .optional()
          .describe("When true, return only checkout-featured products"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ productIds, currency, categoryId, destinationId, offerCode, featured }) => handleToolError(async () => {
      const query = new URLSearchParams();
      if (currency) query.set("currency", currency);
      if (categoryId) query.set("categoryId", categoryId);
      if (destinationId) query.set("destinationId", destinationId);
      if (offerCode) query.set("offerCode", offerCode);
      if (featured !== undefined) query.set("featured", String(featured));
      if (productIds) {
        for (const id of productIds) {
          query.append("productIds[]", id);
        }
      }
      const qs = query.toString();
      const path = qs ? `/products?${qs}` : "/products";
      const products = await client.get<VentrataProduct[]>(path);
      const summary = products.map((p) => ({
        id: p.id,
        internalName: p.internalName,
        title: p.title,
        timeZone: p.timeZone,
        country: p.country,
        defaultCurrency: p.defaultCurrency,
        optionCount: p.options.length,
        options: p.options.map((o) => ({
          id: o.id,
          name: o.internalName,
          startTimes: o.availabilityLocalStartTimes,
          units: o.units.map((u) => ({
            id: u.id,
            type: u.type,
            name: u.internalName,
          })),
        })),
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    })
  );

  server.registerTool(
    "get_product",
    {
      title: "Get Product",
      description:
        "Get detailed information about a specific Ventrata product (tour) by its ID. Returns the full product including description, highlights, inclusions/exclusions, meeting point, pricing, images, and all options with units.",
      inputSchema: z.object({
        productId: z.string().describe("The Ventrata product UUID"),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR') to get pricing in a specific currency"),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code or combination code for discounted pricing (requires octo/offers capability)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ productId, currency, offerCode }) => handleToolError(async () => {
      const query = new URLSearchParams();
      if (currency) query.set("currency", currency);
      if (offerCode) query.set("offerCode", offerCode);
      const qs = query.toString();
      const id = safePathSegment(productId);
      const path = qs ? `/products/${id}?${qs}` : `/products/${id}`;
      const product = await client.get<VentrataProduct>(path);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(product, null, 2) }],
      };
    })
  );
}
