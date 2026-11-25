import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync(new URL('../supabase/functions/six-agent-report-metrics/index.ts',import.meta.url),'utf8');
test('requires JWT signature and pinned issuer audience',()=>{assert.match(file,/jwtVerify\(/);assert.match(file,/issuer:ISSUER/);assert.match(file,/audience:AUDIENCE/);assert.match(file,/algorithms:\['RS256'\]/)});
test('restricts repository, workflow and branch',()=>{for(const s of ['1365196828','refs/heads/main','six-agent-observability.yml','workflow_ref','repository_id'])assert.ok(file.includes(s))});
test('reads report aggregates without fetching completion evidence',()=>{assert.ok(!file.includes('consultation_requests'));assert.match(file,/rpc\/six_agent_report_metrics/);assert.doesNotMatch(file,/completed_evidence/);assert.ok(!file.includes('input,goal'))});
test('rejects invalid aggregates and keeps only safe report fields',()=>{assert.match(file,/Number\.isSafeInteger/);assert.match(file,/completed_with_evidence/);assert.match(file,/rows\.length!==AGENTS\.length/)});
test('rejects missing tokens and incomplete aggregate results',()=>{assert.match(file,/respond\(401/);assert.match(file,/rows.length!==AGENTS.length/);assert.match(file,/respond\(503/)});
