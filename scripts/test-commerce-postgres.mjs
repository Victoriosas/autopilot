// Disposable PostgreSQL cluster: no existing URL, data directory or credentials are used.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const executable = name => bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const directory = await mkdtemp(join(tmpdir(), 'victoriosa-checkout-test-'));
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
// PostgreSQL on Windows can inherit pipes. Ignore stdio and await the launcher exit,
// so the test runner never waits for server-owned pipe handles to close.
const run = (name, args) => new Promise((resolve, reject) => {
  const child = spawn(executable(name), args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${name} exited ${code}; inspect ${directory}`)));
});
let started = false;
try {
  await run('initdb', ['-D', join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale']);
  await run('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  await run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'victoriosa_checkout_test']);
  const child = execFile(process.execPath, ['--import', 'tsx', '--test', 'tests/commerce-postgres.test.ts'], {
    windowsHide: true,
    env: { ...process.env, COMMERCE_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/victoriosa_checkout_test`, PSQL_PATH: executable('psql') },
  });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
} finally {
  if (started) await run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']);
  console.log(`Disposable cluster stopped; synthetic evidence retained at ${directory}`);
}
