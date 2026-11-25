/**
 * Authenticated, read-only Supabase Cron wake preflight.
 * This is NOT an executor or a durable heartbeat. No task claim/write/send.
 */
export interface DirectorWakeConfig {
  token: string | undefined;
  now?: () => Date;
}
function json(status: number, value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
async function equalToken(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const left = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(provided)));
  const right = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

const ALLOWED_PATHS = new Set([
  '/functions/v1/autopilot-director-wake',
  '/autopilot-director-wake',
]);
export function createDirectorWakeHandler(config: DirectorWakeConfig) {
  return async function directorWake(request: Request): Promise<Response> {
    if (!ALLOWED_PATHS.has(new URL(request.url).pathname)) {
      return json(404, { error: 'not_found' });
    }
    if (request.method !== 'POST') {
      return json(405, { error: 'method_not_allowed' });
    }
    const expected = config.token;
    if (!expected || expected.length < 32 || expected.length > 256) {
      return json(503, { error: 'wake_not_configured' });
    }
    const supplied = request.headers.get('x-autopilot-wake-token') ?? '';
    if (supplied.length < 32 || supplied.length > 256 ||
        !(await equalToken(supplied, expected))) {
      return json(401, { error: 'unauthorized' });
    }
    return json(200, {
      state: 'wake_preflight_authenticated',
      executed: false,
      tasksClaimed: 0,
      noSend: true,
      at: (config.now ?? (() => new Date()))().toISOString(),
    });
  };
}
