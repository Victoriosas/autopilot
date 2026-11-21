import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Own disposable cluster only. Never links to hosted Supabase, discovers credentials or reuses a prior lab.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CATALOG_DEMO_PORT || 29553);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [28447, 29447].includes(port)) throw Error('catalog_demo_port_denied');
const bin = process.env.POSTGRES_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const command = name => bin ? path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'LANG'].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
const workspace = await mkdtemp(path.join(tmpdir(), 'autopilot-catalog-demo-'));
const data = path.join(workspace, 'data');
const receipt = path.join(workspace, 'receipt.json');
const passwordFile = path.join(workspace, 'initdb-password');
const passFile = path.join(workspace, 'pgpass');
// libpq clients inherit only the file path, never a password in their arguments or URL.
env.PGPASSFILE = passFile;
const run = (name, args, timeout = 15000) => {
  const result = spawnSync(command(name), args, { cwd: repo, windowsHide: true, env, timeout, stdio: 'ignore' });
  if (result.error || result.status !== 0) throw Error(`catalog_demo_${name}_failed`);
};
let started = false;
let proof;
try {
  const password = randomBytes(32).toString('hex');
  await writeFile(passwordFile, `${password}\n`, { mode: 0o600, flag: 'wx' });
  await writeFile(passFile, `127.0.0.1:${port}:*:postgres:${password}\n`, { mode: 0o600, flag: 'wx' });
  run('initdb', ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile', passwordFile, '--no-locale', '-E', 'UTF8']);
  await rm(passwordFile);
  run('pg_ctl', ['-D', data, '-o', `-p ${port} -h 127.0.0.1`, '-l', path.join(workspace, 'postgres.log'), '-w', 'start']);
  started = true;
  run('createdb', ['--no-password', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'victoriosa_catalog_demo']);
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/catalog-integration-postgres.test.ts'], {
    cwd: repo, windowsHide: true, timeout: 90000, stdio: 'inherit', env: { ...env,
      PSQL_PATH: command('psql'), CATALOG_TEST_DATABASE_URL: `postgres://postgres@127.0.0.1:${port}/victoriosa_catalog_demo`,
      CATALOG_DEMO_RECEIPT: receipt },
  });
  if (result.error || result.status !== 0) throw Error('catalog_demo_proof_failed');
  const output = process.argv[2];
  if (output) await writeFile(path.resolve(output), await readFile(receipt));
  const observed = JSON.parse(await readFile(receipt, 'utf8'));
  proof = { label: 'SIMULADO', receipt, source: observed.source, sourceClean: observed.sourceClean,
    copiedReceipt: output ? path.resolve(output) : null, status: 'PROBADO' };
} finally {
  try {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  } finally {
    // Retained synthetic data and receipts must not retain plaintext credentials.
    await Promise.all([passwordFile, passFile].map(file => rm(file, { force: true })));
  }
  // Preserve the receipt and synthetic SQL data. No recursive cleanup or process-name termination.
}
console.log(JSON.stringify({ ...proof, ownedClusterStopped: true }));
