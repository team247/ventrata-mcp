import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client — we're testing validation logic, not API calls
const mockClient = { get: vi.fn(), post: vi.fn() };

// Import the register function and create a mock server that captures handlers
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

describe("check_availability validation", () => {
  let handlers: Record<string, Function>;

  beforeEach(async () => {
    const { registerAvailabilityTools } = await import("./availability.js");
    handlers = captureToolHandler(registerAvailabilityTools);
  });

  it("rejects localDateStart without localDateEnd", async () => {
    const result = await handlers["check_availability"]({
      productId: "test", optionId: "DEFAULT",
      localDateStart: "2026-03-01",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("localDateStart and localDateEnd must be provided together");
  });

  it("rejects localDateEnd without localDateStart", async () => {
    const result = await handlers["check_availability"]({
      productId: "test", optionId: "DEFAULT",
      localDateEnd: "2026-03-01",
    });
    expect(result.isError).toBe(true);
  });

  it("rejects when no availability selector is provided", async () => {
    const result = await handlers["check_availability"]({
      productId: "test", optionId: "DEFAULT",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("At least one availability selector is required");
  });

  it("calls API when valid date range is provided", async () => {
    mockClient.post.mockResolvedValueOnce([]);
    const result = await handlers["check_availability"]({
      productId: "test", optionId: "DEFAULT",
      localDateStart: "2026-03-01", localDateEnd: "2026-03-02",
    });
    expect(result.isError).toBeUndefined();
    expect(mockClient.post).toHaveBeenCalledWith("/availability", expect.objectContaining({
      productId: "test", optionId: "DEFAULT",
    }));
  });

  it("rejects single-product range > 31 days", async () => {
    const result = await handlers["check_availability_calendar"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2026-03-01", localDateEnd: "2026-04-15",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("maximum is 31");
  });

  it("rejects batch range > 7 days", async () => {
    const result = await handlers["check_availability_calendar_batch"]({
      localDateStart: "2026-03-01", localDateEnd: "2026-03-15",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("maximum is 7");
  });

  it("rejects inverted date range", async () => {
    const result = await handlers["check_availability_calendar"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2026-03-10", localDateEnd: "2026-03-01",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("on or after");
  });

  it("rejects check_availability range > 31 days", async () => {
    const result = await handlers["check_availability"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2026-03-01", localDateEnd: "2026-04-15",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("maximum is 31");
  });

  it("rejects impossible calendar date in localDateStart (April 31)", async () => {
    const result = await handlers["check_availability_calendar"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2026-04-31", localDateEnd: "2026-05-05",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'2026-04-31' is not a valid calendar date");
  });

  it("rejects impossible calendar date in localDateEnd (Feb 29 in non-leap year)", async () => {
    const result = await handlers["check_availability_calendar"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2026-02-01", localDateEnd: "2026-02-29",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'2026-02-29' is not a valid calendar date");
  });

  it("accepts Feb 29 in actual leap year (2024)", async () => {
    mockClient.post.mockResolvedValueOnce([]);
    const result = await handlers["check_availability_calendar"]({
      productId: "p", optionId: "DEFAULT",
      localDateStart: "2024-02-28", localDateEnd: "2024-02-29",
    });
    expect(result.isError).toBeUndefined();
  });

  it("rejects impossible calendar date in batch tools too", async () => {
    const result = await handlers["check_availability_calendar_batch"]({
      localDateStart: "2026-02-30", localDateEnd: "2026-03-02",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'2026-02-30' is not a valid calendar date");
  });
});
