// Offline only. Inspect exact supported flags before use; no network or deploy.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildConsultationAgentManifest, compareConsultationDefinitions } from '../src/storefront/consultationAgentManifest';

const args = process.argv.slice(2);
const target = 'docs/consultation-agents/camelrun-agent-manifest.json';
if (args.length === 0 || args.length === 1 && args[0] === '--check') {
  const expected = JSON.stringify(buildConsultationAgentManifest(), null, 2) + '\n';
  if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== expected) throw Error('AGENT_MANIFEST_DRIFT');
  console.log('AGENT_MANIFEST_MATCHES_SOURCE');
} else if (args.length === 1 && args[0] === '--write') {
  writeFileSync(target, JSON.stringify(buildConsultationAgentManifest(), null, 2) + '\n');
  console.log('LOCAL_MANIFEST_WRITTEN_NO_REMOTE_CHANGE');
} else if (args.length === 2 && args[0] === '--snapshot') {
  const result = compareConsultationDefinitions(JSON.parse(readFileSync(args[1], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (result.some(v => !v.matches)) process.exitCode = 1;
} else if (args.length === 1 && args[0] === '--help') {
  console.log('Offline: --check (default), --write (local generated file), --snapshot <local minimized JSON>. No deploy/apply or network.');
} else throw Error('UNSUPPORTED_MANIFEST_ARGUMENTS');
