import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseCheckoutCheck } from './releaseCheckout';

test('release gate cannot claim commerce is ready while atomic checkout is unavailable', async () => {
  const state = await releaseCheckoutCheck(async () => ({requested:true,available:false,reason:'ATOMIC_CHECKOUT_NOT_ENABLED'}));
  assert.equal(state.ok, false);
  assert.equal(state.requiredForCommerce, true);
  assert.equal(state.detail, 'ATOMIC_CHECKOUT_NOT_ENABLED');
});
test('release gate reports database failure without leaking diagnostics', async () => {
  const state = await releaseCheckoutCheck(async () => { throw Error('private connection details'); });
  assert.equal(state.ok, false);
  assert.equal(state.detail, 'COMMERCE_AVAILABILITY_UNVERIFIED');
});
test('release gate accepts verified checkout availability only', async () => {
  assert.equal((await releaseCheckoutCheck(async () => ({requested:true,available:true,reason:null}))).ok,true);
  assert.equal((await releaseCheckoutCheck(async () => ({requested:false,available:false,reason:'CHECKOUT_DISABLED'}))).ok,false);
});
