import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type VentrataClient, handleToolError } from "../client.js";
import type { VentrataCalendarDay, VentrataBatchCalendarDay, VentrataAvailabilitySlot, VentrataBatchAvailabilitySlot } from "../types.js";

const MAX_DAYS_SINGLE_PRODUCT = 31;
const MAX_DAYS_BATCH = 7;

// Validates that a YYYY-MM-DD string represents a real calendar date.
// Date.parse silently rolls over impossible dates (e.g. 2026-04-31 -> May 1,
// 2026-02-29 -> March 1). Round-trip through toISOString to catch this.
function isValidCalendarDate(dateStr: string): boolean {
  const parsed = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === dateStr;
}

/** Returns null if the inclusive date range start..end is within `maxDays`, otherwise an MCP error result. */
function checkDateRange(start: string, end: string, maxDays: number, label: string) {
  if (!isValidCalendarDate(start)) {
    return { isError: true as const, content: [{ type: "text" as const, text: `Error: ${label} localDateStart '${start}' is not a valid calendar date.` }] };
  }
  if (!isValidCalendarDate(end)) {
    return { isError: true as const, content: [{ type: "text" as const, text: `Error: ${label} localDateEnd '${end}' is not a valid calendar date.` }] };
  }
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  if (endMs < startMs) {
    return { isError: true as const, content: [{ type: "text" as const, text: `Error: ${label} localDateEnd must be on or after localDateStart.` }] };
  }
  const days = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  if (days > maxDays) {
    return { isError: true as const, content: [{ type: "text" as const, text: `Error: ${label} date range is ${days} days; maximum is ${maxDays}. Split into smaller windows.` }] };
  }
  return null;
}

export function registerAvailabilityTools(server: McpServer, client: VentrataClient) {
  server.registerTool(
    "check_availability_calendar",
    {
      title: "Check Availability Calendar",
      description:
        "Check daily availability calendar for a product over a date range. Returns one entry per day with available/sold-out status, vacancies, start times, and pricing summary. Use this for an overview of which days have availability. Dates must be YYYY-MM-DD. Max 31 days per request — split larger windows into multiple calls. Optionally pass units to check capacity for a specific group size.",
      inputSchema: z.object({
        productId: z.string().describe("The Ventrata product UUID"),
        optionId: z
          .string()
          .describe("The option ID — use 'DEFAULT' when the product has a single default option"),
        localDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date in YYYY-MM-DD format"),
        localDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date in YYYY-MM-DD format"),
        units: z
          .array(
            z.object({
              id: z.string().describe("The unit ID (e.g. 'adult', 'child') — get from list_products"),
              quantity: z.number().int().min(1).max(100, "Maximum 100 per unit type").describe("Number of this unit type"),
            })
          )
          .optional()
          .describe("Unit quantities to check capacity for (e.g. 2 adults, 1 child). Without this, results show general availability without group-size validation."),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR') for pricing display"),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code for discounted pricing (requires octo/offers capability)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ productId, optionId, localDateStart, localDateEnd, units, currency, offerCode }) => {
      const rangeError = checkDateRange(localDateStart, localDateEnd, MAX_DAYS_SINGLE_PRODUCT, "check_availability_calendar");
      if (rangeError) return rangeError;
      return handleToolError(async () => {
        const body: Record<string, unknown> = { productId, optionId, localDateStart, localDateEnd };
        if (units) body.units = units;
        if (currency) body.currency = currency;
        if (offerCode) body.offerCode = offerCode;
        const days = await client.post<VentrataCalendarDay[]>(
          "/availability/calendar",
          body
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(days, null, 2) }],
        };
      });
    }
  );

  server.registerTool(
    "check_availability",
    {
      title: "Check Availability",
      description:
        "Check availability for specific time slots. Returns individual slots with availabilityId, exact start/end times, vacancies, pricing, and meeting point. Requires productId and optionId plus at least one selector: localDateStart+localDateEnd (date range, max 31 days), localDate (single date), availabilityId (single slot), or availabilityIds (multiple slots).",
      inputSchema: z.object({
        productId: z.string().describe("The Ventrata product UUID"),
        optionId: z
          .string()
          .describe("The option ID — use 'DEFAULT' when the product has a single default option"),
        localDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Start date for range query (YYYY-MM-DD). Requires localDateEnd."),
        localDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("End date for range query (YYYY-MM-DD). Requires localDateStart."),
        localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Single date query (YYYY-MM-DD). Alternative to date range."),
        availabilityId: z.string().optional().describe("Single availability ID (ISO 8601 local date-time). Alternative to date selectors."),
        availabilityIds: z.array(z.string()).optional().describe("Multiple availability IDs. Alternative to date selectors."),
        units: z
          .array(
            z.object({
              id: z.string().describe("The unit ID (e.g. 'adult', 'child') — get from list_products"),
              quantity: z.number().int().min(1).max(100, "Maximum 100 per unit type").describe("Number of this unit type"),
            })
          )
          .optional()
          .describe("Unit quantities to check capacity for (e.g. 2 adults, 1 child). Without this, results show general availability without group-size validation."),
        localTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
          .optional()
          .describe("Filter by local start time (e.g. '09:00'). Only returns slots starting at this time."),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR') for pricing display"),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code for discounted pricing (requires octo/offers capability)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ productId, optionId, localDateStart, localDateEnd, localDate, availabilityId, availabilityIds, units, localTime, currency, offerCode }) => {
      // Validate date range pair
      if ((localDateStart && !localDateEnd) || (!localDateStart && localDateEnd)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: localDateStart and localDateEnd must be provided together as a date range pair." }],
        };
      }
      // Validate at least one availability selector is provided
      if (!localDate && !localDateStart && !availabilityId && !availabilityIds) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Error: At least one availability selector is required: localDate, localDateStart+localDateEnd, availabilityId, or availabilityIds." }],
        };
      }
      // Enforce documented 31-day cap when querying by date range
      if (localDateStart && localDateEnd) {
        const rangeError = checkDateRange(localDateStart, localDateEnd, MAX_DAYS_SINGLE_PRODUCT, "check_availability");
        if (rangeError) return rangeError;
      }
      return handleToolError(async () => {
        const body: Record<string, unknown> = { productId, optionId };
        if (localDateStart) body.localDateStart = localDateStart;
        if (localDateEnd) body.localDateEnd = localDateEnd;
        if (localDate) body.localDate = localDate;
        if (availabilityId) body.availabilityId = availabilityId;
        if (availabilityIds) body.availabilityIds = availabilityIds;
        if (units) body.units = units;
        if (localTime) body.localTime = localTime;
        if (currency) body.currency = currency;
        if (offerCode) body.offerCode = offerCode;
        const slots = await client.post<VentrataAvailabilitySlot[]>(
          "/availability",
          body
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(slots, null, 2) }],
        };
      });
    }
  );

  server.registerTool(
    "check_availability_calendar_batch",
    {
      title: "Check Availability Calendar (Batch)",
      description:
        "Check daily availability calendar across multiple products over a date range. Returns entries per day per product/option. Use this for batch queries like 'show availability across all Rome tours next week'. For single-product queries use check_availability_calendar instead. Omit productIds to query all products. Designed for back-office batch processing. Max 7 days per request — split larger windows into multiple calls.",
      inputSchema: z.object({
        localDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date in YYYY-MM-DD format"),
        localDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date in YYYY-MM-DD format"),
        productIds: z
          .array(z.string())
          .max(50, "Maximum 50 product IDs per batch request")
          .optional()
          .describe("Product IDs to query. Omit to query all products."),
        units: z
          .array(
            z.object({
              id: z.string().describe("The unit ID (e.g. 'adult', 'child')"),
              quantity: z.number().int().min(1).max(100, "Maximum 100 per unit type").describe("Number of this unit type"),
            })
          )
          .optional()
          .describe("Unit quantities to check capacity for"),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR')"),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code for discounted pricing (requires octo/offers capability)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ localDateStart, localDateEnd, productIds, units, currency, offerCode }) => {
      const rangeError = checkDateRange(localDateStart, localDateEnd, MAX_DAYS_BATCH, "check_availability_calendar_batch");
      if (rangeError) return rangeError;
      return handleToolError(async () => {
        const body: Record<string, unknown> = { localDateStart, localDateEnd };
        if (productIds) body.productIds = productIds;
        if (units) body.units = units;
        if (currency) body.currency = currency;
        if (offerCode) body.offerCode = offerCode;
        const days = await client.post<VentrataBatchCalendarDay[]>(
          "/availability/calendar/batch",
          body
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(days, null, 2) }],
        };
      });
    }
  );

  server.registerTool(
    "check_availability_batch",
    {
      title: "Check Availability (Batch)",
      description:
        "Check detailed time-slot availability across multiple products. Returns slots with availabilityId, times, vacancies, and pricing per product/option. Use this for batch queries like 'find all available 9am tours tomorrow'. For single-product queries use check_availability instead. Omit productIds to query all products. Designed for back-office batch processing. Max 7 days per request — split larger windows into multiple calls.",
      inputSchema: z.object({
        localDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date in YYYY-MM-DD format"),
        localDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date in YYYY-MM-DD format"),
        productIds: z
          .array(z.string())
          .max(50, "Maximum 50 product IDs per batch request")
          .optional()
          .describe("Product IDs to query. Omit to query all products."),
        units: z
          .array(
            z.object({
              id: z.string().describe("The unit ID (e.g. 'adult', 'child')"),
              quantity: z.number().int().min(1).max(100, "Maximum 100 per unit type").describe("Number of this unit type"),
            })
          )
          .optional()
          .describe("Unit quantities to check capacity for"),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, "Must be 3-letter ISO 4217 code")
          .optional()
          .describe("ISO 4217 currency code (e.g. 'USD', 'EUR')"),
        offerCode: z
          .string()
          .optional()
          .describe("Offer code for discounted pricing (requires octo/offers capability)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ localDateStart, localDateEnd, productIds, units, currency, offerCode }) => {
      const rangeError = checkDateRange(localDateStart, localDateEnd, MAX_DAYS_BATCH, "check_availability_batch");
      if (rangeError) return rangeError;
      return handleToolError(async () => {
        const body: Record<string, unknown> = { localDateStart, localDateEnd };
        if (productIds) body.productIds = productIds;
        if (units) body.units = units;
        if (currency) body.currency = currency;
        if (offerCode) body.offerCode = offerCode;
        const slots = await client.post<VentrataBatchAvailabilitySlot[]>(
          "/availability/batch",
          body
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(slots, null, 2) }],
        };
      });
    }
  );
}
