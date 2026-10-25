import test from 'node:test';import assert from 'node:assert/strict';
import {summarize,retrieveReport,markdown} from './agent-daily-report.mjs';
test('counts audited tasks only',()=>{const r=summarize([{agent_id:'director',status:'completed',completed_evidence:'yes',updated_at:'2026-10-25T00:00:00Z'},{agent_id:'director',status:'completed',updated_at:'2026-10-25T00:00:00Z'}]);assert.equal(r.agents[0].completedWithEvidence,1);assert.equal(r.agents.length,6)});
test('missing key fails closed',async()=>assert.equal((await retrieveReport({url:'https://example.com'})).report,null));
test('failed HTTP never pretends verified',async()=>assert.equal((await retrieveReport({url:'https://example.com',key:'test',fetcher:async()=>({ok:false,status:403})})).report,null));
test('report excludes task payload and customer data',()=>{const r=summarize([{agent_id:'reports',status:'blocked',input:{email:'private@example.com'}}]);assert.equal(JSON.stringify(r).includes('private@example.com'),false);assert.equal(markdown(r,'ok').includes('private@example.com'),false)});
