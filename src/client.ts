import { appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { VentrataError } from "./types.js";

export class VentrataClient {
  private apiKey: string;
  private baseUrl: string;
  private capabilities: string;
  private debug: boolean;
  private logFile: string;
  logFn: ((level: string, data: unknown) => Promise<void>) | null = null;

  constructor() {
    const apiKey = process.env.VENTRATA_API_KEY;
    if (!apiKey) {
      throw new Error("VENTRATA_API_KEY environment variable is required");
    }
    this.apiKey = apiKey;
    // Default is Ventrata's only public API base URL; override via env for testing/proxying
    this.baseUrl = process.env.VENTRATA_BASE_URL ?? "https://api.ventrata.com/octo";
    this.capabilities = process.env.VENTRATA_CAPABILITIES ?? "octo/pricing,octo/content,octo/cart,octo/questions,octo/offers,octo/cardPayments";
    this.debug = process.env.VENTRATA_DEBUG === "true";
    this.logFile = process.env.VENTRATA_LOG_FILE ?? join(tmpdir(), "ventrata-mcp.log");
  }

  getLogFile(): string {
    return this.logFile;
  }

  private writeLog(entry: object): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    console.error(`[ventrata-mcp] ${line}`);
    try {
      appendFileSync(this.logFile, line + "\n");
    } catch {
      // ignore log write errors
    }
  }

  private async debugLog(entry: object, summary?: string): Promise<void> {
    if (!this.debug) {
      return;
    }
    this.writeLog(entry);
    if (this.logFn && summary) {
      await this.logFn("info", summary);
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Octo-Capabilities": this.capabilities,
      Accept: "application/json",
    };
  }

  // Redact PII-bearing query params from a URL before logging.
  private redactUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl);
      const redactedKeys = /^(contact|email|phone)/i;
      for (const key of Array.from(u.searchParams.keys())) {
        if (redactedKeys.test(key)) {
          u.searchParams.set(key, "***");
        }
      }
      return u.toString();
    } catch {
      return rawUrl;
    }
  }

  // Returns true if the endpoint path is known to return PII in the body.
  private isPiiPath(path: string): boolean {
    return /\/bookings(\b|\/)|\/orders(\b|\/)/.test(path);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown, retries = 0): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.headers();
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const loggedUrl = this.redactUrl(url);
    const loggedPath = (() => {
      try { const u = new URL(loggedUrl); return u.pathname + u.search; }
      catch { return path; }
    })();
    const loggedBody = this.isPiiPath(path) && body ? "<redacted>" : body ?? null;
    await this.debugLog(
      {
        direction: "request",
        method,
        url: loggedUrl,
        headers: { ...headers, Authorization: `Bearer ****${this.apiKey.slice(-4)}` },
        body: loggedBody,
      },
      JSON.stringify({ direction: "request", method, url: loggedUrl })
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        console.error(`[ventrata-mcp] Request timeout: ${method} ${loggedPath}`);
        throw new Error("Ventrata API request timed out after 30 seconds. Check network connectivity or try again.");
      }
      console.error(`[ventrata-mcp] Request failed: ${method} ${loggedPath} — ${err instanceof Error ? err.message : String(err)}`);
      throw new Error(`Ventrata API request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Retry on 429 with exponential backoff (max 3 retries: 1s, 2s, 4s)
    if (response.status === 429 && retries < 3) {
      const delay = Math.pow(2, retries) * 1000;
      console.error(`[ventrata-mcp] Rate limited (429), retrying in ${delay}ms (attempt ${retries + 1}/3): ${method} ${loggedPath}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(method, path, body, retries + 1);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.error(`[ventrata-mcp] Non-JSON response: ${method} ${loggedPath} — HTTP ${response.status}, content-type: ${response.headers.get("content-type")}`);
      throw new Error(
        `Ventrata API error: expected JSON response but got ${response.headers.get("content-type")} (HTTP ${response.status})`
      );
    }

    const bodyText = JSON.stringify(data);
    const bodyPreview = this.isPiiPath(path)
      ? `<redacted — ${bodyText.length} bytes>`
      : bodyText.length > 500 ? bodyText.slice(0, 500) + "..." : bodyText;
    await this.debugLog(
      {
        direction: "response",
        method,
        url: loggedUrl,
        status: response.status,
        bodyPreview,
      },
      JSON.stringify({ direction: "response", method, url: loggedUrl, status: response.status })
    );

    if (!response.ok) {
      const err = data as VentrataError;
      console.error(`[ventrata-mcp] API error: ${method} ${loggedPath} — HTTP ${response.status}, error: ${err.error ?? "unknown"}`);
      if (response.status === 403) {
        throw new Error("Ventrata API authentication failed (403 Forbidden). Check that VENTRATA_API_KEY is valid and has access to this supplier.");
      }
      if (response.status === 429) {
        throw new Error("Ventrata API rate limit exceeded after 3 retries. Try again later.");
      }
      if (err.errorCode === "CAPABILITIES_REQUIRED" || err.error === "CAPABILITIES_REQUIRED") {
        throw new Error("Ventrata API requires Octo-Capabilities header. This is a bug in the MCP server — the header should always be set.");
      }
      throw new Error(
        `Ventrata API error (${response.status}): ${err.errorMessage ?? JSON.stringify(data)}`
      );
    }

    // Handle error responses returned with 200 status (Ventrata may return { error, errorMessage } on 200)
    if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
      const err = data as VentrataError;
      console.error(`[ventrata-mcp] 200-status error: ${method} ${loggedPath} — error: ${err.error}`);
      throw new Error(
        `Ventrata API error (in 200 response): ${err.errorMessage ?? err.error ?? JSON.stringify(data)}`
      );
    }

    return data as T;
  }
}

/**
 * Encodes a user-supplied ID as a single URL path segment.
 * Rejects empty strings and anything containing /, \, or . path traversal.
 * Blocks URLs like /products/../../whoami from escaping the /octo base path.
 */
export function safePathSegment(value: string): string {
  if (!value || value.includes("/") || value.includes("\\") || value === "." || value === "..") {
    throw new Error(`Invalid path segment: ${JSON.stringify(value)}`);
  }
  return encodeURIComponent(value);
}

/**
 * Wraps a tool's async work in a try/catch that returns { isError: true } on failure.
 * Per MCP spec: "Tool errors should be reported within the result object, not as protocol-level errors."
 */
export async function handleToolError(fn: () => Promise<{ content: { type: "text"; text: string }[] }>): Promise<{ isError?: boolean; content: { type: "text"; text: string }[] }> {
  try {
    return await fn();
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    };
  }
}
