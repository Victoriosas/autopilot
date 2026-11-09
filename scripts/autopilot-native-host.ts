import { readManifest, launchNativeHost } from '../src/autopilot/nativeHost';
const args=process.argv.slice(2);
try {
  if (args.length!==3||args[0]!=='--manifest'||!['--manual','--native'].includes(args[2])) throw Error('invalid_arguments');
  process.exitCode=await launchNativeHost(await readManifest(args[1]),args[2]==='--manual');
} catch {
  console.log(JSON.stringify({event:'native_entry_rejected',code:'native_launch_rejected',launcherPid:process.pid}));process.exitCode=2;
}
