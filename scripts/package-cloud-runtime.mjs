import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
if(git('status','--porcelain','--untracked-files=no'))throw Error('clean_committed_tree_required');
if(git('branch','--show-current')!=='autopilot-integration')throw Error('integration_branch_required');
const sha=git('rev-parse','HEAD');
const root='output/cloud-runtime-v3';
await mkdir(root+'/functions/autopilot-director-wake',{recursive:true});
const outfile=root+'/functions/autopilot-director-wake/index.ts';
await build({entryPoints:['supabase/functions/autopilot-director-wake/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile,
 define:{__AUTOPILOT_ARTIFACT_SHA__:JSON.stringify(sha)}});
await writeFile(root+'/config.toml','[functions.autopilot-director-wake]\nverify_jwt = false\n');
const digest=createHash('sha256').update(await readFile(outfile)).digest('hex');
await writeFile(root+'/manifest.json',JSON.stringify({sha,sha256:digest,entry:outfile,activated:false,noSend:true},null,2)+'\n');
console.log(JSON.stringify({sha,sha256:digest,activated:false}));
