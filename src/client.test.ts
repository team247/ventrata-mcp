import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("VentrataClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, VENTRATA_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when VENTRATA_API_KEY is missing", async () => {
    delete process.env.VENTRATA_API_KEY;
    const { VentrataClient } = await import("./client.js");
    expect(() => new VentrataClient()).toThrow("VENTRATA_API_KEY environment variable is required");
  });

  it("throws on 403 with auth message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ error: "FORBIDDEN", errorMessage: "Invalid key" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    await expect(client.get("/test")).rejects.toThrow("authentication failed");
  });

  it("throws on 429 with rate limit message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: "RATE_LIMITED", errorMessage: "Too many requests" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const promise = client.get("/test");
    promise.catch(() => {}); // prevent unhandled rejection warning during timer advancement
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow("rate limit");
    vi.useRealTimers();
  });

  it("logs request and response via logFn when VENTRATA_DEBUG is true", async () => {
    process.env.VENTRATA_DEBUG = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: "abc" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const logs: { level: string; data: unknown }[] = [];
    client.logFn = async (level, data) => { logs.push({ level, data }); };
    await client.get("/products");

    expect(logs.length).toBe(2);
    const reqLog = String(logs[0].data);
    const resLog = String(logs[1].data);
    expect(logs[0].level).toBe("info");
    // logFn gets short summary; full details (with redacted token) go to log file
    expect(reqLog).toContain("/products");
    expect(reqLog).toContain("request");
    // Verify response status is logged
    expect(resLog).toContain('"status":200');
  });

  it("does not log when VENTRATA_DEBUG is not set", async () => {
    delete process.env.VENTRATA_DEBUG;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: "abc" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const logs: { level: string; data: unknown }[] = [];
    client.logFn = async (level, data) => { logs.push({ level, data }); };
    await client.get("/products");

    expect(logs.length).toBe(0);
  });

  it("throws on non-JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => { throw new Error("not json"); },
      headers: new Headers({ "content-type": "text/html" }),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    await expect(client.get("/test")).rejects.toThrow("expected JSON");
  });
});

describe("safePathSegment", () => {
  it("rejects path traversal sequences", async () => {
    const { safePathSegment } = await import("./client.js");
    expect(() => safePathSegment("..")).toThrow("Invalid path segment");
    expect(() => safePathSegment(".")).toThrow("Invalid path segment");
    expect(() => safePathSegment("")).toThrow("Invalid path segment");
    expect(() => safePathSegment("../whoami")).toThrow("Invalid path segment");
    expect(() => safePathSegment("a/b")).toThrow("Invalid path segment");
    expect(() => safePathSegment("a\\b")).toThrow("Invalid path segment");
  });

  it("encodes valid segments", async () => {
    const { safePathSegment } = await import("./client.js");
    expect(safePathSegment("abc-123")).toBe("abc-123");
    expect(safePathSegment("id with space")).toBe("id%20with%20space");
  });
});

describe("debug log redaction", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, VENTRATA_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("redacts PII query params from URL in debug logs", async () => {
    process.env.VENTRATA_DEBUG = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([]),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const logs: { level: string; data: unknown }[] = [];
    client.logFn = async (level, data) => { logs.push({ level, data }); };

    await client.get("/bookings?localDate=2026-03-01&contactEmailAddress=real@example.com&contactPhoneNumber=5551234&contactLastName=Smith");

    const combined = logs.map((l) => String(l.data)).join("\n");
    expect(combined).not.toContain("real@example.com");
    expect(combined).not.toContain("5551234");
    expect(combined).not.toContain("Smith");
    expect(combined).toContain("contactEmailAddress=***");
    expect(combined).toContain("localDate=2026-03-01");
  });

  it("redacts response body preview for /bookings paths", async () => {
    process.env.VENTRATA_DEBUG = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ contact: { emailAddress: "leak@example.com" }, uuid: "b1" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const logs: { level: string; data: unknown }[] = [];
    client.logFn = async (level, data) => { logs.push({ level, data }); };

    await client.get("/bookings/some-uuid");

    const combined = logs.map((l) => String(l.data)).join("\n");
    expect(combined).not.toContain("leak@example.com");
  });

  it("redacts response body preview for /orders paths", async () => {
    process.env.VENTRATA_DEBUG = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ contact: { phoneNumber: "+15551234" }, orderId: "ORD-1" }),
      headers: new Headers(),
    }));
    const { VentrataClient } = await import("./client.js");
    const client = new VentrataClient();
    const logs: { level: string; data: unknown }[] = [];
    client.logFn = async (level, data) => { logs.push({ level, data }); };

    await client.get("/orders/some-id");

    const combined = logs.map((l) => String(l.data)).join("\n");
    expect(combined).not.toContain("+15551234");
  });
});

describe("handleToolError", () => {
  it("passes through successful result unchanged", async () => {
    const { handleToolError } = await import("./client.js");
    const result = await handleToolError(async () => ({
      content: [{ type: "text", text: "ok" }],
    }));
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("ok");
  });

  it("catches Error and returns isError with message", async () => {
    const { handleToolError } = await import("./client.js");
    const result = await handleToolError(async () => {
      throw new Error("something broke");
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("something broke");
  });

  it("catches non-Error throw and returns stringified value", async () => {
    const { handleToolError } = await import("./client.js");
    const result = await handleToolError(async () => {
      throw "raw string error";
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("raw string error");
  });
});
