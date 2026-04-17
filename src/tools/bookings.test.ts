import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = { get: vi.fn(), post: vi.fn() };

function captureToolHandler(registerFn: Function) {
  const handlers: Record<string, Function> = {};
  const mockServer = {
    registerTool: (name: string, _config: unknown, handler: Function) => {
      handlers[name] = handler;
    },
  };
  registerFn(mockServer, mockClient);
  return handlers;
}

describe("list_bookings validation", () => {
  let handlers: Record<string, Function>;

  beforeEach(async () => {
    const { registerBookingTools } = await import("./bookings.js");
    handlers = captureToolHandler(registerBookingTools);
  });

  it("rejects when no primary filter is provided", async () => {
    const result = await handlers["list_bookings"]({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("At least one primary filter is required");
  });

  it("rejects unpaired utcCreatedAtStart", async () => {
    const result = await handlers["list_bookings"]({
      utcCreatedAtStart: "2026-03-01T00:00:00Z",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("utcCreatedAtStart and utcCreatedAtEnd must be provided together");
  });

  it("accepts localDate as primary filter", async () => {
    mockClient.get.mockResolvedValueOnce([]);
    const result = await handlers["list_bookings"]({
      localDate: "2026-03-01",
    });
    expect(result.isError).toBeUndefined();
  });
});
