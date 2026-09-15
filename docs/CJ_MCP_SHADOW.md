# CJ MCP read-only shadow bridge

Victoriosa can optionally connect to CJ Dropshipping's official remote MCP server for operator/admin read-only queries while keeping the existing REST CJ client as the sourcing fallback.

## Required environment

Use one of:

- `CJ_MCP_SERVER_URL=https://developers.cjdropshipping.com/mcp/<MCP_TOKEN>`
- `CJ_MCP_TOKEN=<MCP_TOKEN>`

And explicitly enable the bridge:

- `CJ_MCP_SHADOW_ENABLED=true`
- `AUTOPILOT_SHADOW_MODE=true`
- `CHECKOUT_ENABLED=false`
- `AUTOPILOT_PURCHASE_LIMIT_USD=0`
- `AUTOPILOT_LEGACY_SOURCING_ENABLED=false`

Never expose the MCP token as a `VITE_*` variable.

## Safety model

The bridge is admin-authenticated and only allows a hard-coded read-only tool allowlist. Write-capable tools such as `create_order`, `add_to_cart`, `create_dispute`, `merge_orders`, product connection mutations and shop product writes are rejected before any network request.

REST CJ remains configured through `CJ_API_KEY` and is not removed by this integration.

## Endpoints

- `GET /api/autopilot/v4/cj-mcp/status`
- `GET /api/autopilot/v4/cj-mcp/status?probe=1`
- `POST /api/autopilot/v4/cj-mcp/call`

Example request body for a read-only call:

```json
{
  "tool": "search_products",
  "args": {
    "keyword": "facial headband",
    "pageSize": 3
  }
}
```

The status probe is optional and should only be used after the MCP token is configured. No purchasing, checkout, payment or automatic publishing capability is enabled by this bridge.
