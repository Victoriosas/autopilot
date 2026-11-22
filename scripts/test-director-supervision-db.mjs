// Explicit local lab only. Installs nothing, creates no schedules and never uses a hosted URL.
import { mkdtemp, writeFile, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const bin = process.env.DIRECTOR_LAB_PG_BINDIR;
const fix = process.env.DIRECTOR_LAB_LEASE_FIX_SQL;
if (!bin || !path.isAbsolute(bin) || !fix) throw Error('Set DIRECTOR_LAB_PG_BINDIR and DIRECTOR_LAB_LEASE_FIX_SQL; no tools are installed automatically');
if (createHash('sha256').update(await readFile(fix)).digest('hex') !== '9c36d6949b3f44c24605cf57b2bd634fc202d22708aa4b7a1c7b9bac88f7e9a1')
  throw Error('Reviewed PR272 migration required, unchanged');
const exe = name => path.join(bin, name + (process.platform==='win32'?'.exe':''));
for (const name of ['initdb','pg_ctl']) await access(exe(name));
const root = await mkdtemp(path.join(tmpdir(),'director-supervision-pg-'));
const data = path.join(root,'data');
const password = randomBytes(32).toString('hex');
const pwfile = path.join(root,'password');
await writeFile(pwfile,password,{mode:0o600});
const listener = createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
const port = listener.address().port;
await new Promise(resolve=>listener.close(resolve));
// Do not inherit PGHOST/PGOPTIONS, application credentials or connection redirections.
const env = {PATH:process.env.PATH,...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),
  PGPASSWORD:password,PGCONNECT_TIMEOUT:'3',
  DIRECTOR_LAB_DATABASE_URL:`postgresql://lab_owner:${password}@127.0.0.1:${port}/victoriosa_director_supervision_lab`,
  DIRECTOR_LAB_LEASE_FIX_SQL:path.resolve(fix),
  ...(process.env.PSQL_PATH?{PSQL_PATH:process.env.PSQL_PATH}:{})};
const run = (program,args,output='ignore') => new Promise((resolve,reject)=>{
  const child = spawn(program,args,{env,stdio:['ignore',output,output],windowsHide:true});
  child.once('error',()=>reject(Error('local_lab_command_failed')));
  child.once('close',code=>code===0?resolve():reject(Error('local_lab_command_failed')));
});
let started = false;
try {
  await run(exe('initdb'),['-D',data,'-U','lab_owner','--pwfile',pwfile,'--auth=scram-sha-256','--no-locale','--encoding=UTF8']);
  // Port race is fail-closed. No connection is attempted unless our own pg_ctl confirms startup.
  await run(exe('pg_ctl'),['-D',data,'-l',path.join(root,'server.log'),'-o',
    `-h 127.0.0.1 -p ${port}${process.platform==='win32'?'':` -k "${root}"`}`,'-w','start']);
  started=true;
  await run(process.env.CREATEDB_PATH||'createdb',['-h','127.0.0.1','-p',String(port),'-U','lab_owner','-w','victoriosa_director_supervision_lab']);
  await run(process.execPath,['--import','tsx','--test',fileURLToPath(new URL('../tests/director-supervision-postgres.test.ts',import.meta.url))],'inherit');
} finally {
  // Never delete a cluster if its shutdown could not be confirmed.
  if (started) await run(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop']);
  await rm(root,{recursive:true,force:true});
}
