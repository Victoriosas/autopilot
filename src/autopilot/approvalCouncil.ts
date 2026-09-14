import { aiStructuredCompletion } from '../services/aiClient';
import type { ProductDraft } from './draftBuilder';

export type CouncilDecision = 'approve' | 'reject';
export type CouncilAgentId = 'commercial' | 'quality_risk' | 'governor';

export interface CouncilVote {
  agent: CouncilAgentId;
  decision: CouncilDecision;
  confidence: number;
  reason: string;
  concerns: string[];
}

export interface CouncilResult {
  decision: CouncilDecision;
  quorum: '2_of_3' | '3_of_3';
  votes: CouncilVote[];
  debatePerformed: boolean;
  summary: string;
  ownerEscalationRequired: boolean;
  escalationReasons: string[];
}

interface AgentDefinition {
  id: CouncilAgentId;
  label: string;
  focus: string;
  task: 'structured_analysis' | 'deep_reasoning';
}

const AGENTS: AgentDefinition[] = [
  {
    id: 'commercial',
    label: 'Estratega Comercial',
    focus: 'rentabilidad, claridad de oferta, precio, demanda, posicionamiento y capacidad de conversión sin exagerar beneficios',
    task: 'structured_analysis',
  },
  {
    id: 'quality_risk',
    label: 'Auditor de Calidad y Riesgo',
    focus: 'procedencia de datos, claims, cumplimiento, seguridad del consumidor, consistencia de ficha y señales de riesgo',
    task: 'structured_analysis',
  },
  {
    id: 'governor',
    label: 'Gobernador Victoriosa',
    focus: 'equilibrio entre oportunidad comercial, reputación de marca, evidencia, riesgo y reglas del sistema',
    task: 'deep_reasoning',
  },
];

function clampConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function sanitizeConcerns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function hardEscalations(draft: ProductDraft): string[] {
  const reasons: string[] = [];
  const supplierCost = draft.provenance?.supplierCost;
  if (supplierCost !== 'verified' && supplierCost !== 'observed') {
    reasons.push('supplier_cost_not_verified_or_observed');
  }
  if (!Number.isFinite(draft.commercial?.confidence) || draft.commercial.confidence < 75) {
    reasons.push('commercial_confidence_below_75');
  }
  const text = [
    draft.title,
    draft.subtitle,
    draft.description,
    ...(draft.features || []),
    ...(draft.tags || []),
    ...(draft.warnings || []),
  ].join(' ').toLowerCase();
  const regulatedSignals = [
    'cura ', 'curar ', 'trata ', 'tratamiento médico', 'diagnóstico', 'medicamento',
    'prescripción', 'enfermedad', 'garantizado', 'milagroso', 'clínicamente probado',
  ];
  if (regulatedSignals.some((term) => text.includes(term))) {
    reasons.push('possible_medical_or_regulated_claim');
  }
  return reasons;
}

async function askAgent(
  agent: AgentDefinition,
  draft: ProductDraft,
  transcript?: CouncilVote[]
): Promise<CouncilVote> {
  const debateContext = transcript?.length
    ? `\nVOTOS PREVIOS DEL CONSEJO:\n${JSON.stringify(transcript)}\nReconsidera tu decisión después de leer los argumentos de los otros agentes.`
    : '';

  const prompt = `
Actúas como ${agent.label} dentro del Consejo de Aprobación de Victoriosa.
Tu foco principal es: ${agent.focus}.

Debes decidir si este BORRADOR DE PRODUCTO puede pasar a estado comercial aprobado.
No estás autorizando compras a proveedores, reembolsos, secretos, claims médicos ni productos regulados.

REGLAS:
- Usa solo la información del borrador.
- No inventes evidencia ni datos del proveedor.
- Rechaza si detectas claims no respaldados, datos contradictorios o riesgo significativo.
- No rechaces por preferencias estéticas menores si la ficha es comercialmente válida.
- Devuelve JSON estricto con: decision (approve|reject), confidence (0-100), reason, concerns (array de strings).
${debateContext}

BORRADOR:
${JSON.stringify(draft)}
`;

  const raw = await aiStructuredCompletion<any>(prompt, null, agent.task);
  if (!raw || (raw.decision !== 'approve' && raw.decision !== 'reject')) {
    return {
      agent: agent.id,
      decision: 'reject',
      confidence: 0,
      reason: 'El agente no produjo una decisión válida; se aplica rechazo seguro.',
      concerns: ['invalid_or_unavailable_agent_response'],
    };
  }

  return {
    agent: agent.id,
    decision: raw.decision === 'approve' && clampConfidence(raw.confidence) >= 75 && typeof raw.reason === 'string' && raw.reason.trim() ? 'approve' : 'reject',
    confidence: clampConfidence(raw.confidence),
    reason: typeof raw.reason === 'string' && raw.reason.trim()
      ? raw.reason.trim().slice(0, 1000)
      : 'Sin justificación utilizable.',
    concerns: sanitizeConcerns(raw.concerns),
  };
}

function resolveMajority(votes: CouncilVote[]): { decision: CouncilDecision; quorum: '2_of_3' | '3_of_3' } {
  const approvals = votes.filter((vote) => vote.decision === 'approve').length;
  const rejects = votes.length - approvals;
  const unanimous = approvals === 3 || rejects === 3;
  return {
    decision: approvals >= 2 ? 'approve' : 'reject',
    quorum: unanimous ? '3_of_3' : '2_of_3',
  };
}

export async function runApprovalCouncil(draft: ProductDraft): Promise<CouncilResult> {
  const escalationReasons = hardEscalations(draft);
  if (escalationReasons.length > 0) {
    return {
      decision: 'reject',
      quorum: '3_of_3',
      votes: AGENTS.map((agent) => ({
        agent: agent.id,
        decision: 'reject' as const,
        confidence: 100,
        reason: 'Bloqueo determinista previo al debate por regla de seguridad o evidencia.',
        concerns: escalationReasons,
      })),
      debatePerformed: false,
      summary: `Escalado al propietario: ${escalationReasons.join(', ')}`,
      ownerEscalationRequired: true,
      escalationReasons,
    };
  }

  const collect = async (transcript?: CouncilVote[]) => {
    const results = await Promise.allSettled(AGENTS.map(agent => askAgent(agent,draft,transcript)));
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    return results.map(result => (result as PromiseFulfilledResult<CouncilVote>).value);
  };
  let votes = await collect();
  const initial = resolveMajority(votes);
  const unanimousInitially = initial.quorum === '3_of_3';

  if (!unanimousInitially) {
    votes = await collect(votes);
  }

  const finalDecision = resolveMajority(votes);
  const averageConfidence = Math.round(votes.reduce((sum, vote) => sum + vote.confidence, 0) / 3);

  return {
    decision: finalDecision.decision,
    quorum: finalDecision.quorum,
    votes,
    debatePerformed: !unanimousInitially,
    summary: `${finalDecision.decision === 'approve' ? 'Aprobado' : 'Rechazado'} por ${finalDecision.quorum.replace('_', ' ')}. Confianza media ${averageConfidence}%.`,
    ownerEscalationRequired: false,
    escalationReasons: [],
  };
}
