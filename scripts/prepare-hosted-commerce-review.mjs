// Offline review bundle only. Does not connect, link, apply SQL or repair history.
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = await readFile(join(root, 'tests/hosted-migrations-canonical.sql'), 'utf8');
const history = [...canonical.matchAll(/^-- BEGIN (\d{14})_([^\r\n]+)$/gm)].map(([,version,name])=>({version,name}));
if (history.length !== 21 || new Set(history.map(row=>row.version)).size !== 21) throw Error('CANONICAL_HISTORY_CHANGED');
const latest = history.at(-1).version;
const expected = ['20261010010000_atomic_checkout.sql','20261010020000_payment_reference_recovery.sql','20261011005345_product_stock_after_publication.sql','20261011050519_explicit_data_api_grants.sql','20261011114131_revoke_catalog_archive_public_execute.sql','20261012010000_provider_oauth_token_ciphertext_compat.sql'];
const forward = (await readdir(join(root,'supabase/migrations'))).filter(name=>/^\d{14}_.*\.sql$/.test(name) && name.slice(0,14)>latest).sort();
if (JSON.stringify(forward)!==JSON.stringify(expected)) throw Error('FORWARD_MIGRATIONS_CHANGED_REVIEW_REQUIRED');
const directory = await mkdtemp(join(tmpdir(),'autopilot-hosted-review-'));
const destination = join(directory,'pending-sql');
await mkdir(destination);
const files=[];
for (const name of forward) {
  const content=await readFile(join(root,'supabase/migrations',name));
  const target=join(destination,name);
  await writeFile(target,content,{flag:'wx'});
  const digest=data=>createHash('sha256').update(data).digest('hex');
  const hash=digest(content);
  if (digest(await readFile(target))!==hash) throw Error('COPY_VERIFICATION_FAILED');
  files.push({name,sha256:hash});
}
const manifest={project:'jfjzpwlrhzqbcrvqxhzf',site:'https://victoriosas.online',generatedAt:new Date().toISOString(),source:resolve(root),history,files,linked:false,sqlApplied:false,requires:['fresh hosted schema and history comparison','verified backup and restore procedure','review of SQL and grants','disposable replay','reviewed deployment plan'],rollback:'Disable checkout; retain durable orders and records. Do not drop commerce tables containing payment data.'};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
await writeFile(join(directory,'README.txt'),'REVIEW ONLY: this is not a Supabase CLI project. No config, credentials or link are included. Do not run db push from the repository migration directory. The 21 canonical versions are inventory, not SQL to replay on the hosted project. Review and backup are required before applying the six pending changes.\n',{flag:'wx'});
console.log(JSON.stringify({directory,files:files.length,hashesVerified:true,linked:false,sqlApplied:false}));
