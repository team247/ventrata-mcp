import { describe, it, expect } from "vitest";
import { sanitizeBooking, sanitizeOrder, sanitizeUnitItem } from "./sanitize.js";

describe("sanitizeUnitItem", () => {
  it("keeps only whitelisted fields", () => {
    const raw = {
      uuid: "u1",
      unitId: "unit-1",
      unit: { id: "unit-1" },
      status: "CONFIRMED",
      pricing: { currency: "USD" },
      contact: { emailAddress: "leak@example.com", fullName: "Leak Person" },
      ticket: { url: "https://ventrata.example/ticket/abc.pdf" },
      notes: "private note",
    };
    const out = sanitizeUnitItem(raw);
    expect(out).toEqual({
      uuid: "u1",
      unitId: "unit-1",
      unit: { id: "unit-1" },
      status: "CONFIRMED",
      pricing: { currency: "USD" },
    });
    expect(Object.keys(out)).not.toContain("contact");
    expect(Object.keys(out)).not.toContain("ticket");
    expect(Object.keys(out)).not.toContain("notes");
  });
});

describe("sanitizeBooking", () => {
  it("drops contact, notes, and any field not in the allowlist", () => {
    const raw = {
      uuid: "b1",
      status: "CONFIRMED",
      productId: "p1",
      contact: { emailAddress: "leak@example.com" },
      notes: "private",
      questionAnswers: [{ questionId: "q1", answer: "sensitive" }],
      agent: { emailAddress: "agent@example.com" },
      reseller: { billingEmail: "finance@example.com" },
      invoiceUrl: "https://ventrata.example/invoices/secret.pdf",
      waiverUrl: "https://ventrata.example/waivers/secret.pdf",
      unitItems: [
        {
          uuid: "ui1",
          unitId: "u1",
          status: "CONFIRMED",
          contact: { emailAddress: "leak@example.com" },
          ticket: { url: "https://ventrata.example/ticket/abc.pdf" },
        },
      ],
    };
    const out = sanitizeBooking(raw);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("leak@example.com");
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("sensitive");
    expect(serialized).not.toContain("agent@example.com");
    expect(serialized).not.toContain("finance@example.com");
    expect(serialized).not.toContain("invoices/secret.pdf");
    expect(serialized).not.toContain("waivers/secret.pdf");
    expect(serialized).not.toContain("ticket/abc.pdf");
    expect(out.uuid).toBe("b1");
    expect(out.status).toBe("CONFIRMED");
    expect(Array.isArray(out.unitItems)).toBe(true);
  });

  it("handles missing unitItems", () => {
    const out = sanitizeBooking({ uuid: "b1" });
    expect(out.unitItems).toEqual([]);
  });
});

describe("sanitizeOrder", () => {
  it("drops contact and propagates sanitization to nested bookings", () => {
    const raw = {
      id: "o1",
      orderId: "ORD-123",
      status: "CONFIRMED",
      contact: { emailAddress: "leak@example.com" },
      internalNotes: "confidential",
      bookings: [
        {
          uuid: "b1",
          status: "CONFIRMED",
          contact: { phoneNumber: "+15551234" },
          notes: "private",
          unitItems: [
            { uuid: "ui1", contact: { emailAddress: "leak@example.com" } },
          ],
        },
      ],
    };
    const out = sanitizeOrder(raw);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("leak@example.com");
    expect(serialized).not.toContain("+15551234");
    expect(serialized).not.toContain("confidential");
    expect(serialized).not.toContain("private");
    expect(out.id).toBe("o1");
    expect(out.orderId).toBe("ORD-123");
    expect(Array.isArray(out.bookings)).toBe(true);
    const firstBooking = (out.bookings as Array<Record<string, unknown>>)[0];
    expect(firstBooking.uuid).toBe("b1");
  });
});
