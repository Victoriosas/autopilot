import { runReadinessDevelopment } from '../src/autopilot/readinessDevelopment';
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--repository' || args[2] !== '--base-sha' || args[4] !== '--lab-root') {
  console.error('usage: development:readiness -- --repository <approved checkout> --base-sha <approved SHA> --lab-root <dedicated directory>');
  process.exitCode = 2;
} else {
  const stop = new AbortController(); process.once('SIGINT', () => stop.abort()); process.once('SIGTERM', () => stop.abort());
  try {
    const result = await runReadinessDevelopment({ repository: args[1], baseSha: args[3], root: args[5] }, { signal: stop.signal });
    console.log(JSON.stringify(result)); if (!['completed','no_change'].includes(result.state)) process.exitCode = 1;
  } catch (error) { console.error(error instanceof Error && /^[a-z_]{3,64}$/.test(error.message) ? error.message : 'development_blocked'); process.exitCode = 1; }
}
