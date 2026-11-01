import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync(new URL('../supabase/functions/six-agent-report-metrics/index.ts',import.meta.url),'utf8');
test('requires JWT signature and pinned issuer audience',()=>{assert.match(file,/jwtVerify\(/);assert.match(file,/issuer:ISSUER/);assert.match(file,/audience:AUDIENCE/);assert.match(file,/algorithms:\['RS256'\]/)});
test('restricts repository, workflow and branch',()=>{for(const s of ['1365196828','refs/heads/main','six-agent-observability.yml','workflow_ref','repository_id'])assert.ok(file.includes(s))});
test('never returns raw consultation content',()=>{assert.ok(!file.includes('consultation_requests'));assert.match(file,/select','agent_id,status,updated_at,completed_evidence'/);assert.ok(!file.includes('input,goal'))});
test('rejects missing tokens and partial results',()=>{assert.match(file,/respond\(401/);assert.match(file,/rows.length>=1000/);assert.match(file,/respond\(503/)});
