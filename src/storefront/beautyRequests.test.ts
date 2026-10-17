import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeautyRequest, beautyWhatsAppUrl } from './beautyRequests';

const valid = { id:'8f7c7698-cdbe-4a77-8a86-5a1d090284b5', firstName:'Cliente', lastName:'Prueba', contact:'099123456', zone:'Solymar', service:'facial', availability:'Lunes de tarde', source:'web', consent:true, consentVersion:'beauty-v1' };
test('beauty accepts a minimal commercial request and requires explicit consent', () => {
  assert.equal(normalizeBeautyRequest(valid).service, 'facial');
  for (const input of [{...valid,consent:false},{...valid,skin:'sensitive'},{...valid,service:'botox'},{...valid,contact:'no-contact'},{...valid,contact:'--------'},{...valid,firstName:'   '}]) {
    assert.throws(()=>normalizeBeautyRequest(input));
  }
});
test('WhatsApp contains only generic text and an opaque receipt, no client details', () => {
  const url = new URL(beautyWhatsAppUrl(valid.id));
  assert.equal(url.pathname, '/59897045305');
  assert.ok(url.searchParams.get('text')?.includes(valid.id));
  for (const value of ['Cliente','099123456','Solymar','sensibilidad']) assert.ok(!url.href.includes(value));
  assert.throws(()=>beautyWhatsAppUrl('not-a-reference'));
});
