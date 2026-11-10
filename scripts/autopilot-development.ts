import { runDevelopmentLab } from '../src/autopilot/selfDevelopment';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--lab-root') {
  console.error('usage: npm run development:lab -- --lab-root <new dedicated directory>'); process.exitCode = 2;
} else {
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort()); process.once('SIGTERM', () => abort.abort());
  try {
    const result = await runDevelopmentLab(args[1], { signal: abort.signal });
    console.log(JSON.stringify({ missionId: result.context.mission.missionId, state: result.context.checkpoint.mission_state,
      version: result.version, evidence: result.context.checkpoint.test_evidence, auditHash: result.hash }));
    if (result.context.checkpoint.mission_state !== 'completed') process.exitCode = 1;
  } catch (e) {
    console.error(e instanceof Error && /^[a-z_]{3,64}$/.test(e.message) ? e.message : 'development_blocked'); process.exitCode = 1;
  }
}
