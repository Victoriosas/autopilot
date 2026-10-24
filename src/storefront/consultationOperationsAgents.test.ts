import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationChannels, prepareConsultationForReview, proposeFollowUps, weeklyContentDrafts, consultationWeeklyReport } from './consultationOperationsAgents';
import type { ConsultationInput } from './consultationRequest';

const sample: ConsultationInput = { id: '8abb9c64-fb63-4c4f-821a-4ac1d9edca91', fullName: 'Persona Ejemplo', phone: '+59897000000', email: 'ejemplo@example.com', age: 30, service: 'asesoria-cosmetologica-online', message: 'Quiero orientación', responseChannel: 'email', consent: true, consentVersion: 'consultation-v1', website: '' };

test('dedicated web and general mailboxes are distinct', () => {
  assert.equal(consultationChannels.web, 'consultas@victoriosas.online');
  assert.equal(consultationChannels.general, 'victoriosas.online@gmail.com');
});
test('agents produce review-only drafts and escalate health', () => {
  const normal = prepareConsultationForReview(sample);
  assert.equal(normal.action, 'draft_for_victoria');
  assert.match(normal.draft, /asesoría cosmetológica online/i);
  const health = prepareConsultationForReview({ ...sample, message: 'Tengo dermatitis' });
  assert.equal(health.category, 'clinical');
  assert.notEqual(health.action, 'send');
});
test('followup agent respects opt-out, consent and reminder limits', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const row = { reference: 'reference-1', consentToFollowUp: true, lastProposalAt: '2026-10-22T12:00:00Z', remindersSent: 0 };
  assert.equal(proposeFollowUps([row], now)[0].kind, 'proposal');
  assert.equal(proposeFollowUps([{ ...row, optedOut: true }], now).length, 0);
  assert.equal(proposeFollowUps([{ ...row, remindersSent: 2 }], now).length, 0);
  assert.equal(proposeFollowUps([{ ...row, consentToFollowUp: false }], now).length, 0);
});
test('content remains drafts; weekly reports return aggregate counts only', () => {
  assert.equal(weeklyContentDrafts().length, 3);
  assert.ok(weeklyContentDrafts().every(x => x.approvalRequired));
  const report = consultationWeeklyReport([{ channel: 'web', status: 'waiting' }, { channel: 'web', status: 'answered', firstReplyMinutes: 15 }]);
  assert.equal(report.web, 2);
  assert.equal(report.averageFirstReplyMinutes, 15);
});
