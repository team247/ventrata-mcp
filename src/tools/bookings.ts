import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError, safePathSegment } from "../client.js";
import { sanitizeBooking } from "../sanitize.js";
import type { VentrataBooking } from "../types.js";

export function registerBookingTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "get_booking",
    {
      title: "Get Booking",
      description:
        "Retrieve a specific booking by its UUID. Returns a curated allowlist of booking fields (status, product, option, unit items, pricing, meeting point, timestamps). Contact details, notes, ticket URLs, and any fields not explicitly whitelisted are dropped — see src/sanitize.ts for the full list.",
      inputSchema: z.object({
        uuid: z.string().describe("The booking UUID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ uuid }) => handleToolError(async () => {
      const booking = await client.get<VentrataBooking>(`/bookings/${safePathSegment(uuid)}`);
      const sanitized = sanitizeBooking(booking as unknown as Record<string, unknown>);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(sanitized, null, 2) }],
      };
    })
  );

  server.registerTool(
    "list_bookings",
    {
      title: "List Bookings",
      description:
        "List bookings with filters. At least one primary filter is required: localDate (YYYY-MM-DD) for a single day, localDateStart + localDateEnd for a range, resellerReference/supplierReference, or utcCreatedAtStart/utcCreatedAtEnd for creation time range. Optional secondary filters: productId, optionId, status/statuses, page, perPage for pagination. Note: contact filter fields (email, phone, last name) contain PII that will appear in AI conversation context when used as search inputs.",
      inputSchema: z.object({
        localDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
          .optional()
          .describe("Filter by local date (YYYY-MM-DD)"),
        localDateStart: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
          .optional()
          .describe("Filter by date range start (YYYY-MM-DD)"),
        localDateEnd: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
          .optional()
          .describe("Filter by date range end (YYYY-MM-DD)"),
        resellerReference: z
          .string()
          .optional()
          .describe("Filter by reseller reference"),
        supplierReference: z
          .string()
          .optional()
          .describe("Filter by supplier reference"),
        utcCreatedAtStart: z
          .string()
          .optional()
          .describe("Filter by creation time range start (ISO 8601, e.g. '2026-03-14T00:00:00Z'). Requires utcCreatedAtEnd."),
        utcCreatedAtEnd: z
          .string()
          .optional()
          .describe("Filter by creation time range end (ISO 8601, e.g. '2026-03-14T23:59:59Z'). Requires utcCreatedAtStart."),
        utcUpdatedAtStart: z
          .string()
          .optional()
          .describe("Filter by updated-at range start (ISO 8601). Requires utcUpdatedAtEnd."),
        utcUpdatedAtEnd: z
          .string()
          .optional()
          .describe("Filter by updated-at range end (ISO 8601). Requires utcUpdatedAtStart."),
        utcRedeemedAtStart: z
          .string()
          .optional()
          .describe("Filter by redeemed-at range start (ISO 8601). Requires utcRedeemedAtEnd."),
        utcRedeemedAtEnd: z
          .string()
          .optional()
          .describe("Filter by redeemed-at range end (ISO 8601). Requires utcRedeemedAtStart."),
        utcCancelledAtStart: z
          .string()
          .optional()
          .describe("Filter by cancelled-at range start (ISO 8601). Requires utcCancelledAtEnd."),
        utcCancelledAtEnd: z
          .string()
          .optional()
          .describe("Filter by cancelled-at range end (ISO 8601). Requires utcCancelledAtStart."),
        availabilityId: z
          .string()
          .optional()
          .describe("Filter by availability ID"),
        contactEmailAddress: z
          .string()
          .optional()
          .describe("Filter by contact email address (PII — will appear in AI conversation context)"),
        contactPhoneNumber: z
          .string()
          .optional()
          .describe("Filter by contact phone number (PII — will appear in AI conversation context)"),
        contactLastName: z
          .string()
          .min(3, "Minimum 3 characters")
          .optional()
          .describe("Filter by contact last name (min 3 chars) (PII — will appear in AI conversation context)"),
        tag: z
          .string()
          .optional()
          .describe("Filter by tag"),
        productId: z
          .string()
          .optional()
          .describe("Filter by product ID (secondary filter)"),
        optionId: z
          .string()
          .optional()
          .describe("Filter by option ID (secondary filter). Use 'DEFAULT' for default option."),
        status: z
          .enum(["ON_HOLD", "CONFIRMED", "CANCELLED", "EXPIRED", "REDEEMED", "NO_SHOW", "PENDING", "REJECTED", "REBOOKED", "QUOTE"])
          .optional()
          .describe("Filter by single booking status"),
        statuses: z
          .array(z.enum(["ON_HOLD", "CONFIRMED", "CANCELLED", "EXPIRED", "REDEEMED", "NO_SHOW", "PENDING", "REJECTED", "REBOOKED", "QUOTE"]))
          .optional()
          .describe("Filter by multiple booking statuses (e.g. ['CONFIRMED', 'ON_HOLD'])"),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Page number for pagination (default: 1)"),
        perPage: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Number of results per page (default: 100, max: 100)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ localDate, localDateStart, localDateEnd, resellerReference, supplierReference, utcCreatedAtStart, utcCreatedAtEnd, utcUpdatedAtStart, utcUpdatedAtEnd, utcRedeemedAtStart, utcRedeemedAtEnd, utcCancelledAtStart, utcCancelledAtEnd, availabilityId, contactEmailAddress, contactPhoneNumber, contactLastName, tag, productId, optionId, status, statuses, page, perPage }) => {
      const query = new URLSearchParams();
      if (localDate) query.set("localDate", localDate);
      if (localDateStart) query.set("localDateStart", localDateStart);
      if (localDateEnd) query.set("localDateEnd", localDateEnd);
      if (resellerReference) query.set("resellerReference", resellerReference);
      if (supplierReference) query.set("supplierReference", supplierReference);
      if (utcCreatedAtStart) query.set("utcCreatedAtStart", utcCreatedAtStart);
      if (utcCreatedAtEnd) query.set("utcCreatedAtEnd", utcCreatedAtEnd);
      if (utcUpdatedAtStart) query.set("utcUpdatedAtStart", utcUpdatedAtStart);
      if (utcUpdatedAtEnd) query.set("utcUpdatedAtEnd", utcUpdatedAtEnd);
      if (utcRedeemedAtStart) query.set("utcRedeemedAtStart", utcRedeemedAtStart);
      if (utcRedeemedAtEnd) query.set("utcRedeemedAtEnd", utcRedeemedAtEnd);
      if (utcCancelledAtStart) query.set("utcCancelledAtStart", utcCancelledAtStart);
      if (utcCancelledAtEnd) query.set("utcCancelledAtEnd", utcCancelledAtEnd);
      if (availabilityId) query.set("availabilityId", availabilityId);
      if (contactEmailAddress) query.set("contactEmailAddress", contactEmailAddress);
      if (contactPhoneNumber) query.set("contactPhoneNumber", contactPhoneNumber);
      if (contactLastName) query.set("contactLastName", contactLastName);
      if (tag) query.set("tag", tag);
      if (productId) query.set("productId", productId);
      if (optionId) query.set("optionId", optionId);
      if (status) query.set("status", status);
      if (statuses) {
        for (const s of statuses) {
          query.append("statuses[]", s);
        }
      }
      if (page) query.set("page", String(page));
      if (perPage) query.set("perPage", String(perPage));

      // Validate date range pairs: both start and end must be provided together
      if ((localDateStart && !localDateEnd) || (!localDateStart && localDateEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: localDateStart and localDateEnd must be provided together as a date range pair." }],
        };
      }
      if ((utcCreatedAtStart && !utcCreatedAtEnd) || (!utcCreatedAtStart && utcCreatedAtEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: utcCreatedAtStart and utcCreatedAtEnd must be provided together as a date range pair." }],
        };
      }
      if ((utcUpdatedAtStart && !utcUpdatedAtEnd) || (!utcUpdatedAtStart && utcUpdatedAtEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: utcUpdatedAtStart and utcUpdatedAtEnd must be provided together as a date range pair." }],
        };
      }
      if ((utcRedeemedAtStart && !utcRedeemedAtEnd) || (!utcRedeemedAtStart && utcRedeemedAtEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: utcRedeemedAtStart and utcRedeemedAtEnd must be provided together as a date range pair." }],
        };
      }
      if ((utcCancelledAtStart && !utcCancelledAtEnd) || (!utcCancelledAtStart && utcCancelledAtEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: utcCancelledAtStart and utcCancelledAtEnd must be provided together as a date range pair." }],
        };
      }

      // Check that at least one primary filter is present (secondary filters alone are not sufficient)
      if (!localDate && !localDateStart && !localDateEnd && !resellerReference && !supplierReference && !utcCreatedAtStart && !utcUpdatedAtStart && !utcRedeemedAtStart && !utcCancelledAtStart && !availabilityId && !contactEmailAddress && !contactPhoneNumber && !contactLastName) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: At least one primary filter is required (localDate, localDateStart/localDateEnd, resellerReference, supplierReference, or utcCreatedAtStart/utcCreatedAtEnd)" }],
        };
      }
      const qs = query.toString();

      return handleToolError(async () => {
        const bookings = await client.get<VentrataBooking[]>(`/bookings?${qs}`);

        const summary = bookings.map((b) => ({
          uuid: b.uuid,
          status: b.status,
          productId: b.productId,
          productName: b.product?.internalName ?? null,
          optionId: b.optionId,
          localDateTimeStart: b.localDateTimeStart,
          localDateTimeEnd: b.localDateTimeEnd,
          unitCount: b.unitItems?.length ?? 0,
          resellerReference: b.resellerReference,
          supplierReference: b.supplierReference,
          utcCreatedAt: b.utcCreatedAt,
          utcConfirmedAt: b.utcConfirmedAt,
          cancellable: b.cancellable,
          pricing: b.pricing,
        }));

        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      });
    }
  );
}
