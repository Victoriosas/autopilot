import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const exe = path.resolve('.lab-tools/deno/node_modules/deno-bin/bin/deno.exe');
if (!existsSync(exe)) {
  console.error('BLOCKED_DENO_NOT_INSTALLED_LOCAL: execute npm install --prefix .lab-tools/deno deno-bin@latest');
  process.exit(77);
}
const result = spawnSync(exe, ['run', '--allow-env', '--allow-net', '--allow-read', '--allow-run', 'scripts/test-director-wake-deno.ts'], {
  cwd: process.cwd(), stdio: 'inherit', windowsHide: true,
});
process.exit(result.status ?? 1);
