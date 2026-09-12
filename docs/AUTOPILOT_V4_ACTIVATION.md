# Autopilot v4 activation

## Goal

Expose the governed control plane at `/api/autopilot/v4` without coupling its internals to the legacy monolithic server.

## Required server change

Add this import near the other server imports:

```ts
import { mountAutopilotV4 } from './src/autopilot/mount';
```

Immediately after `app.use(express.json({ limit: "10mb" }));`, add:

```ts
mountAutopilotV4(app);
```

Do not duplicate routes manually in `server.ts`.

## Security prerequisites

Production must set server-only values for:

- `AUTOPILOT_ADMIN_TOKEN`
- `AUTOPILOT_CODEX_TOKEN`

Never expose either token through a `VITE_` environment variable or frontend bundle. The control plane is expected to fail closed when the admin token is missing.

Autonomous purchasing must remain disabled:

```env
AUTOPILOT_PURCHASE_LIMIT_USD=0
```

until a separate reviewed change explicitly enables it.

## Smoke checks after activation

Unauthenticated request:

```text
GET /api/autopilot/v4/status
Expected: 401/503 fail-closed response, never control-plane data.
```

Authenticated admin request:

```text
GET /api/autopilot/v4/status
Authorization: Bearer <AUTOPILOT_ADMIN_TOKEN>
Expected: 200 with auth, persistence, telemetry, modelRouter and principal status.
```

Authenticated Codex request:

```text
POST /api/autopilot/v4/tasks
Authorization: Bearer <AUTOPILOT_CODEX_TOKEN>
```

Codex credentials must be rejected if the body tries to create a task for any actor other than `codex`.

## Rollback

Remove the `mountAutopilotV4(app)` call and its import. The rest of v4 remains inert and the legacy routes continue unchanged.
