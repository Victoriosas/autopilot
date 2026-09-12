import { aiStructuredCompletion } from '../services/aiClient';
import type { RepricingProposal } from './repricingProposal';

export type RepricingDecision = 'approve' | 'reject';
export type RepricingAgentId = 'margin' | 'customer_value' | 'governor';

export interface RepricingVote {
  agent: RepricingAgentId;
  decision: RepricingDecision;
  confidence: number;
  reason: string;
}

export interface RepricingCouncilResult {
  decision: RepricingDecision;
  quorum: '2_of_3' | '3_of_3';
  votes: RepricingVote[];
  debatePerformed: boolean;
  summary: string;
}

const AGENTS: Array<{ id: RepricingAgentId; focus: string; task: 'structured_analysis' | 'deep_reasoning' }> = [
  { id: 'margin', focus: 'margen, costo observado, rentabilidad y sostenibilidad económica', task: 'structured_analysis' },
  { id: 'customer_value', focus: 'valor percibido, estabilidad de precio y posible impacto sobre conversión y confianza', task: 'structured_analysis' },
  { id: 'governor', focus: 'equilibrio entre evidencia, política comercial, riesgo reputacional y trazabilidad', task: 'deep_reasoning' },
];

function clamp(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function vote(agent: typeof AGENTS[number], proposal: RepricingProposal, transcript?: RepricingVote[]): Promise<RepricingVote> {
  const prompt = `
Eres un agente del Consejo de Repricing de Victoriosa.
Tu foco: ${agent.focus}.
Decide si la PROPUESTA DE PRECIO puede ser aprobada.
No autorizas compras, pagos, reembolsos ni cambios de stock.
Solo puedes usar la evidencia incluida.
Rechaza si la procedencia del costo no es observada, si el precio propuesto no es finito/positivo o si el cambio carece de justificación suficiente.
Devuelve JSON estricto con decision (approve|reject), confidence (0-100), reason.
${transcript?.length ? `VOTOS PREVIOS: ${JSON.stringify(transcript)}\nReconsidera tras leer los otros argumentos.` : ''}
PROPUESTA: ${JSON.stringify(proposal)}
`;

  const raw = await aiStructuredCompletion<any>(prompt, null, agent.task);
  if (!raw || (raw.decision !== 'approve' && raw.decision !== 'reject')) {
    return { agent: agent.id, decision: 'reject', confidence: 0, reason: 'Respuesta inválida o no disponible; rechazo seguro.' };
  }
  return {
    agent: agent.id,
    decision: raw.decision,
    confidence: clamp(raw.confidence),
    reason: typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason.trim().slice(0, 1000) : 'Sin justificación utilizable.',
  };
}

function resolve(votes: RepricingVote[]) {
  const approvals = votes.filter((v) => v.decision === 'approve').length;
  const unanimous = approvals === 3 || approvals === 0;
  return {
    decision: approvals >= 2 ? 'approve' as const : 'reject' as const,
    quorum: unanimous ? '3_of_3' as const : '2_of_3' as const,
  };
}

export async function runRepricingCouncil(proposal: RepricingProposal): Promise<RepricingCouncilResult> {
  if (proposal.status !== 'review_required' || !proposal.proposedPrice || !Number.isFinite(proposal.proposedPrice) || proposal.proposedPrice <= 0 || proposal.provenance.supplierCost !== 'observed') {
    return {
      decision: 'reject',
      quorum: '3_of_3',
      votes: AGENTS.map((agent) => ({ agent: agent.id, decision: 'reject', confidence: 100, reason: 'Bloqueo determinista por evidencia insuficiente o propuesta no apta.' })),
      debatePerformed: false,
      summary: 'Repricing rechazado por regla determinista previa al debate.',
    };
  }

  let votes = await Promise.all(AGENTS.map((agent) => vote(agent, proposal)));
  const first = resolve(votes);
  const unanimousInitially = first.quorum === '3_of_3';
  if (!unanimousInitially) votes = await Promise.all(AGENTS.map((agent) => vote(agent, proposal, votes)));
  const final = resolve(votes);
  const avg = Math.round(votes.reduce((sum, item) => sum + item.confidence, 0) / 3);
  return {
    decision: final.decision,
    quorum: final.quorum,
    votes,
    debatePerformed: !unanimousInitially,
    summary: `${final.decision === 'approve' ? 'Aprobado' : 'Rechazado'} por ${final.quorum.replace('_', ' ')}. Confianza media ${avg}%.`,
  };
}
