import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cloudBinding,validateCloudConfig } from '../src/autopilot/cloudMissionStore.ts';
const exec=promisify(execFile);
export function isolatedHostEnvironment() {
 return Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]));
}
// Reproducible synthetic seed, shared by offline review and the manual CI runner.
export async function prepareHostedHost(root) {
 const repository=path.join(root,'seed'),worktreeRoot=path.join(root,'worktrees');
 await mkdir(repository);await mkdir(worktreeRoot);
 const git=async args=>(await exec('git',['-c','core.hooksPath=/dev/null','-c','core.autocrlf=false',...args],{cwd:repository,
   env:{...isolatedHostEnvironment(),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',
     GIT_AUTHOR_DATE:'2026-11-12T00:00:00Z',GIT_COMMITTER_DATE:'2026-11-12T00:00:00Z'},windowsHide:true,timeout:10000})).stdout.trim();
 await git(['init','--initial-branch=main']);
 await writeFile(path.join(repository,'synthetic-seed.txt'),'Autopilot disposable synthetic repository v1\n');
 await git(['add','synthetic-seed.txt']);
 await git(['-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-m','P0C synthetic seed v1']);
 return validateCloudConfig({version:1,mode:'cloud_synthetic_lab',ledgerId:'synthetic-hosted-p0c',
   database:{host:'db.juyowvmtluxfetgkckjd.supabase.co',port:5432,name:'postgres',user:'autopilot_cloud_runner',
     sslRootCert:path.join(root,'ca.crt'),passFile:path.join(root,'runner.pgpass')},
   resources:{repository,worktreeRoot,baseSha:await git(['rev-parse','HEAD'])},permissions:{admit:false,execute:true,cancel:false},
   leaseSeconds:30,deadlineMs:25000,queryTimeoutMs:3000});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 let root;
 try {root=await mkdtemp(path.join(tmpdir(),'p0c-offline-'));const config=await prepareHostedHost(root);
   console.log(JSON.stringify({baseSha:config.resources.baseSha,binding:cloudBinding(config)}));
 } catch {console.error('hosted_offline_host_failed');process.exitCode=2;}
 finally {if(root)await rm(root,{recursive:true,force:true});}
}
