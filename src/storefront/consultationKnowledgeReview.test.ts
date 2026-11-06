import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeKnowledgeReview, knowledgeReviewLabel } from './consultationKnowledgeReview';
import type { ServiceKnowledge } from './consultationServiceKnowledge';
import { consultationKnowledge } from './consultationKnowledge';

const services = consultationKnowledge.services;
const entry = (patch: Partial<ServiceKnowledge> = {}): ServiceKnowledge => ({
  slug: services[0].slug, version: 1, description: 'Información general revisable.',
  techniques: '', duration: '', conditions: '', faq: '', internalFee: '',
  approvedForAI: false, priceApproved: false, validUntil: null, ...patch,
});

test('F2 inventory is 17 current services; historical catalog rows are not counted', () => {
  const summary = summarizeKnowledgeReview(services, []);
  assert.deepEqual([summary.total,summary.missing,summary.draft,summary.approved,summary.expired], [17,17,0,0,0]);
  assert.equal(summary.priceApproved,0);
  assert.equal(new Set(summary.rows.map(row => row.slug)).size,17);
  assert.ok(summary.rows.every(row => row.state === 'missing' && row.version === null));
});

test('saved but unapproved text is a draft and must not appear as AI approved', () => {
  const summary = summarizeKnowledgeReview(services, [entry()]);
  assert.equal(summary.missing,16);
  assert.equal(summary.draft,1);
  assert.equal(summary.approved,0);
  assert.equal(summary.rows[0].version,1);
  assert.equal(knowledgeReviewLabel.draft, 'Borrador sin aprobación para IA');
});

test('AI approvals are independent from internal fees and never expose amounts', () => {
  const approved = entry({approvedForAI:true,priceApproved:true,internalFee:'9999 UYU'});
  const summary = summarizeKnowledgeReview(services,[approved]);
  assert.equal(summary.approved,1);
  assert.equal(summary.priceApproved,1);
  assert.ok(!JSON.stringify(summary).includes('9999'));
  const feeOnly=summarizeKnowledgeReview(services,[entry({priceApproved:true,internalFee:'9999 UYU'})]);
  assert.equal(feeOnly.approved,0);
  assert.equal(feeOnly.priceApproved,1);
});

test('expired, invalid dates or missing approved descriptions never count as approved', () => {
  const today=Date.parse('2026-11-04T12:00:00.000Z');
  for (const value of ['2026-11-04T11:00:00.000Z','invalid']) {
    const summary=summarizeKnowledgeReview(services,[entry({approvedForAI:true,validUntil:value})],today);
    assert.equal(summary.expired,1);
    assert.equal(summary.approved,0);
    assert.equal(summary.priceApproved,0);
  }
  assert.equal(summarizeKnowledgeReview(services,[entry({approvedForAI:true,description:''})]).approved,0);
  assert.equal(summarizeKnowledgeReview(services,[entry({approvedForAI:true,validUntil:'2026-11-05T00:00:00.000Z'})],today).approved,1);
});

test('unknown stale entries are ignored and counts reconcile exactly',()=>{
  const rows=[entry({slug:'historical-sourcing'}),entry({slug:services[1].slug})];
  const result=summarizeKnowledgeReview(services,rows);
  assert.equal(result.total,17);
  assert.equal(result.draft,1);
  assert.equal(result.missing,16);
  assert.equal(result.total,result.missing+result.draft+result.approved+result.expired);
});
