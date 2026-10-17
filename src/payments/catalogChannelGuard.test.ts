import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCheckoutChannels } from './catalogChannelGuard';

test('server checks current catalog channel before any reservation and fails closed on missing data',async()=>{
 const items=[{productId:'p1',quantity:1}];
 for(const traceability of [{offer:{mode:'affiliate'}},{offer:{mode:'inquiry'}},{offer:null},{offer:{mode:'typo'}}]){
  await assert.rejects(assertCheckoutChannels(items,async()=>[{id:'p1',traceability}]),/PRODUCT_REQUIRES_EXTERNAL_ACTION/);
 }
 await assert.rejects(assertCheckoutChannels(items,async()=>[]),/CATALOG_CHANNEL_UNAVAILABLE/);
 await assert.rejects(assertCheckoutChannels(items,async()=>{throw Error('db');}),/CATALOG_CHANNEL_UNAVAILABLE/);
 await assertCheckoutChannels(items,async(ids)=>{assert.deepEqual(ids,['p1']);return [{id:'p1',traceability:{}}];});
});
