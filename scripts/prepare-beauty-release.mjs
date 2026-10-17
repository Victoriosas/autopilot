// Offline review package only. No clients, environment loading or deployment.
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const files=['20261017220000_beauty_requests.sql','20261017221000_beauty_retention.sql'];
const output=path.resolve('.audit','beauty-release-review');await mkdir(output,{recursive:true});
const migrations=[];
for(const name of files){
 const contents=await readFile(path.join('supabase','migrations',name));
 await writeFile(path.join(output,name),contents);
 migrations.push({name,sha256:createHash('sha256').update(contents).digest('hex')});
}
const manifest={mode:'offline-review-only',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),migrations,productionChanged:false,backupCreated:false,authorizationGranted:false,requirements:['Verified hosted backup and restore procedure','Review existing profiles/auth.uid/RLS and grants','Approve only these two additive migrations; do not db push legacy history','Validate administrator identities, retention operations and privacy notice','Approve deployment commit and commercial scope; payments remain disabled'],rollback:['Disable BEAUTY_REQUESTS_ENABLED','Revert application deployment if necessary','Keep private tables/data for review; no automatic DROP or deletion'],next:'Obtain specific owner approval only after reviewing this package and hosted preflight; no execution command is generated'};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({output,migrations:migrations.length,mode:manifest.mode,productionChanged:false,backupCreated:false}));
