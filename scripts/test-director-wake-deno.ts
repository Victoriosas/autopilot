import assert from 'node:assert/strict';

declare const Deno: {
  args: string[];
  env: { set(name: string, value: string): void; delete(name: string): void };
  realPathSync(path: string | URL): string;
  cwd(): string;
  Command: new (path: string, options: {
    args: string[];
    cwd: string;
    stdout: 'piped';
    stderr: 'piped';
  }) => {
    spawn(): { kill(signal: string): void; status: Promise<unknown> };
  };
};

const base = 'http://127.0.0.1:8000/functions/v1/autopilot-director-wake';
const syntheticToken = 'synthetic-director-wake-' + 'r'.repeat(40);

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(base, { method: 'POST', headers: { 'x-autopilot-wake-token': syntheticToken } });
      await response.arrayBuffer();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('DENO_ENTRYPOINT_NOT_LISTENING');
}

if (Deno.args[0] === 'serve') {
  if (Deno.args[1] === 'configured') {
    Deno.env.set('AUTOPILOT_DIRECTOR_WAKE_TOKEN', syntheticToken);
  } else {
    Deno.env.delete('AUTOPILOT_DIRECTOR_WAKE_TOKEN');
  }
  await import('../supabase/functions/autopilot-director-wake/index.ts');
  await new Promise(() => {});
}

const denoExe = new URL('../.lab-tools/deno/node_modules/deno-bin/bin/deno.exe', import.meta.url);

if (Deno.args.length === 0) {
  const getResult = await runDenoCase('configured', 'GET');
  assert.equal(getResult.status, 405);

  const falseRoute = await runDenoCase('configured', 'POST', '/false-route');
  assert.equal(falseRoute.status, 404);

  const wrongToken = await runDenoCase('configured', 'POST', undefined, 'wrong-synthetic-token');
  assert.equal(wrongToken.status, 401);

  const unconfigured = await runDenoCase('unconfigured', 'POST');
  assert.equal(unconfigured.status, 503);

  const correct = await runDenoCase('configured', 'POST');
  assert.equal(correct.status, 200);
  const body = await correct.json();
  assert.equal(body.executed, false);
  assert.equal(body.tasksClaimed, 0);
  assert.equal(body.noSend, true);

  console.log('DENO_REAL_ENTRYPOINT_LOOPBACK_PASS: GET405,FALSE404,WRONG401,UNCONFIGURED503,CORRECT200');
}

async function runDenoCase(
  mode: 'configured' | 'unconfigured',
  method: 'GET' | 'POST',
  suffix = '',
  token = syntheticToken,
) {
  const command = new Deno.Command(Deno.realPathSync(denoExe), {
    args: ['run', '--allow-env', '--allow-net', '--allow-read', '--allow-run', 'scripts/test-director-wake-deno.ts', 'serve', mode],
    cwd: Deno.cwd(),
    stdout: 'piped',
    stderr: 'piped',
  });
  const child = command.spawn();
  try {
    await waitForServer();
    return await fetch(base + suffix, { method, headers: { 'x-autopilot-wake-token': token } });
  } finally {
    child.kill('SIGTERM');
    await child.status;
  }
}
