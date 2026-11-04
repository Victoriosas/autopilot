import { randomUUID } from 'node:crypto';
import { consultationLabCases } from './consultationLabCases';
import { analyzeConsultation } from './consultationIntelligence';
import { understandConsultation } from './consultationUnderstanding';
import type { ConsultationRecord } from './consultationSupabase';
import type { ConsultationFact } from './consultationEvidence';
import type { ConsultationModel, ModelStage } from './consultationIntelligenceContracts';

export const labAgents = Object.freeze({
  understand: 'victoriosas-lab-comprension-free',
  draft: 'victoriosas-lab-redactor-free',
  review: 'victoriosas-lab-guardian-free',
});
export const labModel = 'google/gemma-4-31b-it';

export function syntheticConsultation(caseId: string, now = new Date()): ConsultationRecord {
  const selected = consultationLabCases.find(item => item.id === caseId);
  if (!selected) throw Error('LAB_CASE_INVALID');
  const id = randomUUID();
  return { id, created_at: now.toISOString(), expires_at: new Date(now.getTime() + 86400000).toISOString(),
    input: { id, fullName: 'Caso sintético', phone: '00000000', email: '', age: null,
      message: selected.message, service: selected.service, responseChannel: 'phone', consent: true,
      consentVersion: 'consultation-v1', aiConsent: selected.id !== 'no-consent', website: '' } };
}

/** Uses the existing shadow analyzer; it has no delivery, customer-store or scheduling dependency. */
export async function runConsultationLab(caseId: string, options: {
  facts: readonly ConsultationFact[]; now?: Date; provider?: ConsultationModel;
} ) {
  const record = syntheticConsultation(caseId, options.now);
  const stages: { stage: ModelStage; agent: string; output: unknown }[] = [];
  const understanding = understandConsultation(record.input);
  const simulation: ConsultationModel = {
    id: 'synthetic-simulation', model: 'deterministic-fixture', configVersion: 'lab-v1', remote: false,
    async complete(stage, payload) {
      if (stage === 'understand') return { topics: understanding.questions.map(q => q.topic),
        serviceCandidates: understanding.serviceCandidates, risks: [], confidence: 0.8, notes: ['Simulación local, sin LLM.'] };
      if (stage === 'draft') return { texts: (payload as { allowedDrafts: string[] }).allowedDrafts };
      return { status: 'approved', codes: [] };
    },
  };
  const provider = options.provider ?? simulation;
  // Remote execution is intentionally unavailable until zero TOTAL cost and the
  // provider's named-agent API contract have been verified. A free model alone
  // does not prove free runtime/storage, and spendLimit is not a preflight quote.
  if (provider.remote || provider.id !== simulation.id) throw Error('LAB_REMOTE_CONTRACT_UNVERIFIED');
  const analysis = await analyzeConsultation(record, { now: options.now, facts: options.facts,
    provider: { ...provider, async complete(stage, payload, schema, signal) {
      const output = await provider.complete(stage, payload, schema, signal);
      stages.push({ stage, agent: labAgents[stage], output });
      return output;
    } },
  });
  return { synthetic: true as const, mode: 'simulation' as const, input: { caseId, message: record.input.message, service: record.input.service, aiConsent: record.input.aiConsent },
    analysis, stages, reviewRequired: true as const, delivery: 'NOT_SENT' as const,
    usage: { inputTokens: null, outputTokens: null, actualCostUsd: 0, basis: 'local_simulation_no_provider_calls' },
    remote: { available: false, model: labModel, agents: labAgents, reason: 'LAB_REMOTE_CONTRACT_UNVERIFIED' },
  };
}
