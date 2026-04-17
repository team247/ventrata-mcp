# Ventrata MCP Server

Use Claude (or any MCP-compatible AI assistant) to query tour products, check availability, and look up bookings and orders in [Ventrata](https://www.ventrata.com/) — the booking platform used by tour operators.

> **Read-only.** This server can never create, modify, confirm, cancel, or refund anything in Ventrata. All calls are lookup-only — the server never sends write operations.

## Quick scan

| | |
|---|---|
| **npm package** | `@gnostra-ai/ventrata-mcp` |
| **Version** | 1.0.0 |
| **License** | MIT |
| **Runtime** | Node.js 18+ |
| **Clients** | Claude Desktop · Claude Code · any MCP-compatible client (stdio) |
| **Install (Claude Code, one command)** | `claude mcp add --scope user ventrata npx -y @gnostra-ai/ventrata-mcp -e VENTRATA_API_KEY=your-key` |

## What you can do

Ask Claude things like:

- "List all products available in our Rome catalog"
- "Check availability for product X next Thursday"
- "Show calendar availability for product Y from July 1 to July 31"
- "List all bookings created today"
- "Find the booking with reseller reference ABC-123"
- "Get the full details of order ORD-4567"
- "Which supplier and connection am I authenticated as?"

## Quick start

Already have a Ventrata API key and Node.js 18+ installed? Add this to your MCP config and you're done:

```json
{
  "mcpServers": {
    "ventrata": {
      "command": "npx",
      "args": ["-y", "@gnostra-ai/ventrata-mcp"],
      "env": { "VENTRATA_API_KEY": "your-api-key" }
    }
  }
}
```

Restart the client, then try: `use ventrata to list all products`.

No key yet? → [Get a Ventrata API key](#get-a-ventrata-api-key). Not sure where the config file lives? → [Client setup](#client-setup).

## Get a Ventrata API key

### Test key (for evaluation)

Ventrata offers a free public sandbox called **EdinExplore** — a fictional Edinburgh-area tour operator with demo products, pricing, and availability. Anyone can sign up; no existing Ventrata account needed.

1. Go to the [EdinExplore sandbox signup](https://dashboard.ventrata.com/octo/signup) (Ventrata's test-supplier portal)
2. Create an account — the API key is shown on the signup confirmation page

Once connected, `use ventrata to list all products` will return EdinExplore's demo tours.

### Production key (for a real supplier)

API keys are issued per **connection** — a supplier creates a connection against the reseller account set up for each partner, and the key scopes product access and pricing to that reseller.

**If you're the supplier** (or have admin access to the supplier's dashboard):

1. Log in to `https://dashboard.ventrata.com/`
2. Go to **Connections → Connections**
3. Click **+ New Connection** and select the partner/reseller
4. Click the eye icon next to the API key to reveal and copy it

**If you're the reseller**, ask the supplier to create a connection for you — they'll send you the resulting key. Each supplier issues its own key, so you'll have a separate key per supplier.

See [Ventrata's authentication docs](https://docs.ventrata.com/getting-started/getting-started).

## Client setup

### Claude Desktop

1. Install [Node.js 18+](https://nodejs.org/)
2. Open Claude Desktop → **Settings → Developer**
3. Click **Edit Config** to open your `claude_desktop_config.json`
4. Add this to the `mcpServers` section (replace `your-api-key`):

```json
{
  "mcpServers": {
    "ventrata": {
      "command": "npx",
      "args": ["-y", "@gnostra-ai/ventrata-mcp"],
      "env": { "VENTRATA_API_KEY": "your-api-key" }
    }
  }
}
```

5. Save and restart Claude Desktop.

### Claude Code

**Project-level** — add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "ventrata": {
      "command": "npx",
      "args": ["-y", "@gnostra-ai/ventrata-mcp"],
      "env": { "VENTRATA_API_KEY": "your-api-key" }
    }
  }
}
```

**User-level** (available in all projects):

```bash
claude mcp add --scope user ventrata \
  npx -y @gnostra-ai/ventrata-mcp \
  -e VENTRATA_API_KEY="your-api-key"
```

Verify with `claude mcp list` — the ventrata row should show `✓ Connected`.

### Other MCP-compatible clients

This is a standard stdio MCP server. Any client that can register stdio MCP servers can use it. The wiring:

- **Command:** `npx`
- **Args:** `-y @gnostra-ai/ventrata-mcp`
- **Required env:** `VENTRATA_API_KEY`
- **Optional env:** see [Configuration](#configuration)

Refer to your client's documentation for how to register stdio servers. Known compatible clients: Cursor, Continue.dev, Zed, and others in the [MCP ecosystem](https://modelcontextprotocol.io/).

## Available tools

Grouped by use case.

### Products
| Tool | What it does |
|---|---|
| `list_products` | List all products (tours) the supplier offers |
| `get_product` | Full product detail by ID: description, options, units, pricing |

### Availability
| Tool | What it does |
|---|---|
| `check_availability_calendar` | Daily availability summary for one product (max 31 days) |
| `check_availability` | Time-slot availability for one product |
| `check_availability_calendar_batch` | Daily availability across multiple products (max 7 days) |
| `check_availability_batch` | Time-slot availability across multiple products (max 7 days) |

### Bookings & orders
| Tool | What it does |
|---|---|
| `get_booking` | Booking detail by UUID (contact info and other PII stripped) |
| `list_bookings` | List bookings with filters (date, reseller/supplier reference, creation time, etc.) |
| `get_order` | Order detail by ID (contact info and other PII stripped) |

### Discovery
| Tool | What it does |
|---|---|
| `whoami` | Current supplier and connection identity |
| `list_capabilities` | OCTO capabilities available to this authenticated supplier/connection |

### Debugging
| Tool | What it does |
|---|---|
| `get_log_path` | Return the effective local debug log file path |

## Configuration

Set via the `env` block in your MCP client config, or via a `.env` file for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VENTRATA_API_KEY` | Yes | — | Ventrata OCTO API bearer token |
| `VENTRATA_BASE_URL` | No | `https://api.ventrata.com/octo` | API base URL |
| `VENTRATA_CAPABILITIES` | No | `octo/pricing,octo/content,octo/cart,octo/questions,octo/offers,octo/cardPayments` | Comma-separated OCTO capabilities. Controls which optional response fields Ventrata returns. See the [full list of capabilities](https://docs.ventrata.com/getting-started/request-capabilities). |
| `VENTRATA_DEBUG` | No | `false` | Log request/response details to stderr and the local log file |
| `VENTRATA_LOG_FILE` | No | `$TMPDIR/ventrata-mcp.log` | Override the local log file path |

## Privacy, safety, and limitations

**Read-only.** All calls are lookup-only — no create, update, or delete. The server cannot modify bookings, orders, products, or availability slots. Some endpoints (like `/availability` and `/availability/batch`) use HTTP POST because Ventrata's API models complex filters as request bodies, but they still only read data; there is no write surface.

**PII stripping on outputs.** `get_booking` and `get_order` responses are sanitized via an explicit allowlist before reaching your LLM:
- `contact` fields (customer name, email, phone, notes) are dropped
- Ticket URLs, unknown fields, and any future top-level PII fields the upstream API adds are dropped automatically
- Nested `product`, `option`, `unit`, `pricing` objects pass through as structural/catalog data

`list_bookings` returns a curated summary with no customer contact info.

**PII redaction in debug logs.** When `VENTRATA_DEBUG=true`:
- URL query parameter values matching `contact*`, `email*`, `phone*` are replaced with `***` before logging
- Response body previews for `/bookings` and `/orders` endpoints are redacted (`<redacted — N bytes>`) in both stderr and the file log

Startup stderr never logs identity (name, email).

**PII on the input side.** `list_bookings` accepts `contactEmailAddress`, `contactPhoneNumber`, `contactLastName` as filter inputs. If you search by one of these, that value appears in your LLM conversation context. The server does not persist input PII.

**Limitations — what this server does NOT do:**
- Create, cancel, reschedule, confirm, or modify any booking
- Submit bookings or process payments
- Admin dashboard operations (reseller management, billing, offer creation)
- Write to any Ventrata resource of any kind

**Use with trusted clients only.** The API key you provide grants full read access to the supplier's data within its scope. Don't use with untrusted LLM clients or in contexts where responses may be exfiltrated.

## Troubleshooting

### "Ventrata API authentication failed (403 Forbidden)"

Your API key is invalid, expired, revoked, or lacks access to the endpoint. Check:
1. The key is copied correctly (no trailing whitespace)
2. The key hasn't been rotated/revoked in the supplier's dashboard
3. Your key's connection type has access to the endpoint you called

### "server not connected" / "spawn npx ENOENT" / "Cannot find module"

Node.js isn't installed or isn't on your PATH.
1. Install [Node.js 18+](https://nodejs.org/) (LTS recommended)
2. Verify `node --version` prints a version in the same terminal you launch Claude from
3. Restart your MCP client

### "Action 'X' not supported. Maybe you're missing a capability?"

Ventrata rejected the call because the required OCTO capability isn't in your `Octo-Capabilities` header. Add the capability to `VENTRATA_CAPABILITIES` in your MCP config `env`. See the [capability list](https://docs.ventrata.com/getting-started/request-capabilities).

### "Connected but no products / empty results / wrong tours"

The API key works but is scoped to the wrong supplier or connection. Ask Claude `use ventrata whoami` — the response tells you which supplier and connection your key is authenticated as. If that doesn't match the account whose products you expect to see, you're using the wrong key; go back to [Get a Ventrata API key](#get-a-ventrata-api-key) and get one for the right supplier/connection.

### "Date range is N days; maximum is 31" or "maximum is 7" or "not a valid calendar date"

The availability tools cap the date window to keep requests bounded:
- Single-product tools (`check_availability_calendar`, `check_availability`) accept up to **31 days** per call
- Batch tools (`check_availability_calendar_batch`, `check_availability_batch`) accept up to **7 days** per call

To query a longer window, split it into multiple calls. You'll also see `'YYYY-MM-DD' is not a valid calendar date` if you pass an impossible date like `2026-02-30` — fix the date and retry.

### Slow / hung responses

The server times out after 30 seconds. If requests consistently time out:
1. Enable `VENTRATA_DEBUG=true` and `tail -f /tmp/ventrata-mcp.log` to see outbound requests
2. Check network access to `https://api.ventrata.com/octo`

### Need more debug info?

Set `VENTRATA_DEBUG=true` in your MCP config. Then either ask `use ventrata get_log_path` for the effective log location, or `tail -f /tmp/ventrata-mcp.log`.

## Development

> **For contributors only.** If you're just using this MCP server, you can stop reading here.

### Architecture

```
src/
  index.ts          — Entry point: wires McpServer + StdioServerTransport
  client.ts         — VentrataClient (HTTP) + handleToolError + safePathSegment + redactUrl
  sanitize.ts       — Allowlist PII sanitizers for booking/order responses
  types.ts          — OCTO API response types
  tools/
    products.ts     — list_products, get_product
    availability.ts — check_availability_calendar, check_availability, batch variants
    bookings.ts     — get_booking, list_bookings
    orders.ts       — get_order
    discovery.ts    — list_capabilities, whoami
    logging.ts      — get_log_path
```

### Local setup

```bash
git clone https://github.com/gnostra-ai/ventrata-mcp.git
cd ventrata-mcp
cp .env.example .env
# Edit .env — set VENTRATA_API_KEY
npm install
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Smoke test against the real API (requires API key in .env)
set -a && source .env && set +a
curl -s "$VENTRATA_BASE_URL/products" \
  -H "Authorization: Bearer $VENTRATA_API_KEY" \
  -H "Octo-Capabilities: $VENTRATA_CAPABILITIES" | python3 -m json.tool | head -20
```

### E2E test prompts

Run these in Claude after registering the server. Replace `<product-id>` with a real ID returned by `use ventrata to list all products` (row 3 below).

| # | Category | Prompt | Expected |
|---|---|---|---|
| 1 | Discovery | `use ventrata whoami` | Supplier identity + connection verified |
| 2 | Discovery | `use ventrata to check what capabilities are available` | List of OCTO capabilities |
| 3 | Products | `use ventrata to list all products` | Product list with IDs |
| 4 | Products | `use ventrata to get details for product <product-id>` | Full product detail |
| 5 | Products | `use ventrata to list products in EUR currency` | Products with EUR pricing |
| 6 | Availability | `use ventrata to check availability for product <product-id> on 2026-07-15` | Time slots for that date |
| 7 | Availability | `use ventrata to check calendar availability for product <product-id> from 2026-07-01 to 2026-07-31` | Daily summary for July |
| 8 | Availability | `use ventrata to batch check calendar for all products from 2026-07-01 to 2026-07-07` | Multi-product calendar |
| 9 | Availability | `use ventrata to batch check availability slots for product <product-id> from 2026-07-15 to 2026-07-16` | Batch time slots |
| 10 | Bookings | `use ventrata to list bookings for today` | Today's bookings (may be empty) |
| 11 | Bookings | `use ventrata to list bookings from 2026-03-01 to 2026-03-31` | March bookings |
| 12 | Orders | `use ventrata to get order details for <order-id>` | Order detail |
| 13 | Edge case | `use ventrata to list bookings for 2099-01-01` | Empty result |
| 14 | Edge case | `use ventrata to get product nonexistent-id` | Graceful error message |

## License

[MIT](LICENSE) © 2026 Gnostra AI
