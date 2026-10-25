import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSite,summary} from './infrastructure-health.mjs';
test('healthy official site reports status and verified brand',async()=>{
 const r=await checkSite({fetcher:async()=>({ok:true,status:200,text:async()=>'<title>Victoriosas</title>'})});
 assert.equal(r.status,200);assert.equal(r.verifiedBrand,true);assert.match(summary(r),/HTTP: 200/);
});
test('fails when page has wrong content',async()=>await assert.rejects(checkSite({fetcher:async()=>({ok:true,status:200,text:async()=>'<title>Proxy error</title>'})}),/brand_not_found/));
test('fails on server error',async()=>await assert.rejects(checkSite({fetcher:async()=>({ok:false,status:503})}),/http_503/));
test('rejects unexpected destination',async()=>await assert.rejects(checkSite({url:'https://bad.example.org',fetcher:async()=>{throw Error('must_not_request')}}),/unapproved_target/));
