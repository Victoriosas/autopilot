import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../../functions/api/[[path]].js';

test('temporary proxy preserves caller auth and errors without forwarding cookies or spoofed IP',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input:any,init:any)=>{
  assert.equal(input,'https://jfjzpwlrhzqbcrvqxhzf.supabase.co/functions/v1/autopilot-api/api/autopilot/v4/agents-status?x=1');
  assert.equal(init.headers.get('authorization'),'Bearer test-session');
  assert.equal(init.headers.get('cookie'),null);
  assert.equal(init.headers.get('x-vercel-forwarded-for'),null);
  assert.equal(init.redirect,'manual');
  return new Response('{"error":"ADMIN_AUTH_INVALID"}',{status:401,headers:{'set-cookie':'bad=1','cache-control':'public'}});
 };
 try{
  const result=await onRequest({request:new Request('https://autopilot-6z5.pages.dev/api/autopilot/v4/agents-status?x=1',{headers:{authorization:'Bearer test-session',cookie:'private=1','x-vercel-forwarded-for':'127.0.0.1'}})});
  assert.equal(result.status,401);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.headers.get('set-cookie'),null);
 }finally{globalThis.fetch=original;}
});
test('temporary proxy fails closed on upstream failure',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('upstream secret');};
 try{const result=await onRequest({request:new Request('https://example.test/api/health')});assert.equal(result.status,503);assert.equal(await result.text(),'{"error":"AUTOPILOT_BACKEND_UNAVAILABLE"}');}
 finally{globalThis.fetch=original;}
});
test('temporary proxy rejects non-API paths',async()=>{
 assert.equal((await onRequest({request:new Request('https://example.test/admin')})).status,404);
});
