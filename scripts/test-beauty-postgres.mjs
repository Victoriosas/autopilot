// Disposable PostgreSQL cluster: no existing URL, data directory or credentials are used.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const executable = name => bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const directory = await mkdtemp(join(tmpdir(), 'victoriosa-beauty-test-'));
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
// PostgreSQL on Windows can inherit pipes. Ignore stdio and await the launcher exit,
// so the test runner never waits for server-owned pipe handles to close.
const run = (name, args) => new Promise((resolve, reject) => {
  const log = join(directory, 'launcher.log');
  const descriptor = openSync(log, 'a');
  // File handles retain useful startup errors without inherited pipe handles.
  const child = spawn(executable(name), args, { windowsHide: true, stdio: ['ignore', descriptor, descriptor] });
  let settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    closeSync(descriptor);
    if (error) reject(error); else resolve();
  };
  child.on('error', error => finish(new Error(`${name}: ${error.message}; inspect ${log}`)));
  child.on('exit', code => finish(code === 0 ? null : new Error(`${name} exited ${code}; inspect ${log}`)));
});
let started = false;
let startAttempted = false;
try {
  await run('initdb', ['-D', join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale']);
  startAttempted = true;
  await run('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  await run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'victoriosa_beauty_test']);
  const child = execFile(process.execPath, ['--import', 'tsx', '--test', 'tests/beauty-postgres.test.ts'], {
    windowsHide: true,
    env: { ...process.env, BEAUTY_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/victoriosa_beauty_test`, PSQL_PATH: executable('psql') },
  });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
} finally {
  if (started) {
    await run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']);
    console.log(`Disposable cluster stopped; synthetic evidence retained at ${directory}`);
  } else if (startAttempted) {
    // pg_ctl can start the server and then fail while waiting for readiness.
    try { await run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']); }
    catch { console.error(`Startup/cleanup failed; inspect ${directory}`); }
  } else {
    console.log(`Disposable cluster was not started; startup diagnostics retained at ${directory}`);
  }
}
