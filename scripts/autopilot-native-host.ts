import path from 'node:path';
import { open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonical, isInside, readManifest, launchNativeHost, type NativePreflightStage } from '../src/autopilot/nativeHost';

const invocationId = randomUUID();
const args = process.argv.slice(2);
let stage: NativePreflightStage | 'diagnostics' | 'arguments' | 'manifest' = 'diagnostics';
let code = 'diagnostics_unavailable';
let exitCode = 2;
let diagnostic: Awaited<ReturnType<typeof open>> | undefined;

async function record(event: 'entry_started' | 'entry_rejected' | 'entry_closed', fields: object = {}) {
  await diagnostic!.writeFile(JSON.stringify({
    timestamp: new Date().toISOString(), invocationId, launcherPid: process.pid, event, stage, ...fields,
  }) + '\n');
  await diagnostic!.sync();
}

try {
  // The diagnostic destination comes from the task action, independently of the manifest.
  const directory = args[1];
  const checkout = fileURLToPath(new URL('../', import.meta.url));
  if (args[0] !== '--diagnostics' || !directory || !path.isAbsolute(directory)
      || (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(directory))
      || isInside(checkout, directory)) throw Error('unsafe_diagnostic_directory');
  await canonical(directory, true);
  diagnostic = await open(path.join(directory, invocationId + '.preflight.jsonl'), 'wx', 0o600);
  await record('entry_started');
  stage = 'arguments';
  code = 'invalid_arguments';
  if (args.length !== 5 || args[2] !== '--manifest' || !['--manual', '--native'].includes(args[4])) throw Error(code);
  stage = 'manifest';
  code = 'invalid_native_manifest';
  const manifest = await readManifest(args[3]);
  exitCode = await launchNativeHost(manifest, args[4] === '--manual', invocationId, (next, rejection) => {
    stage = next;
    code = rejection;
  });
} catch {
  if (diagnostic) await record('entry_rejected', { code, exitCode }).catch(() => {});
  process.stderr.write(JSON.stringify({ event: 'native_entry_rejected', stage, code, invocationId, launcherPid: process.pid, exitCode }) + '\n');
} finally {
  if (diagnostic) {
    try {
      await record('entry_closed', { exitCode });
    } catch {
      process.stderr.write(JSON.stringify({ event: 'native_diagnostics_failed', invocationId, exitCode }) + '\n');
    } finally {
      await diagnostic.close().catch(() => {});
    }
  }
  process.exitCode = exitCode;
}
