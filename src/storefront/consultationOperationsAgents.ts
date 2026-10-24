import type { ConsultationInput } from './consultationRequest';
import { draftConsultationResponse } from './consultationResponseAgents';

/** Internal workflow only. This module never performs network sends, bookings or publication. */
export const consultationChannels = Object.freeze({
  web: 'consultas@victoriosas.online',
  general: 'victoriosas.online@gmail.com',
});

export type ReviewDecision = {
  reference: string;
  category: 'commercial' | 'clinical' | 'urgent' | 'manual';
  action: 'draft_for_victoria' | 'urgent_review';
  priority: 'normal' | 'review' | 'urgent';
  subject: string;
  draft: string;
  issues: readonly string[];
};

/** Agent 1 (triage), agent 2 (writer), agent 3 (guardian). Fail closed. */
export function prepareConsultationForReview(input: ConsultationInput): ReviewDecision {
  const result = draftConsultationResponse(input);
  const issues: string[] = [...result.reasons];
  if (!input.consent) issues.push('consent_missing');
  if (!input.email && input.responseChannel === 'email') issues.push('reply_address_missing');
  if (/\b(?:garantizad[oa]|sin dolor|elimina(?:r)? arrugas|diagn[oó]stico)\b/i.test(result.text)) issues.push('unsafe_claim');
  if (/\$\s*\d|\b(?:UYU|USD)\s*\d/i.test(result.text)) issues.push('price_not_authorized');
  if (!result.text.trim().endsWith('Victoria | Victoriosas')) issues.push('signature_missing');
  if (result.text.trim().split(/\s+/u).length > 120) issues.push('too_long');
  return {
    reference: result.reference,
    category: result.category === 'urgent' ? 'urgent' : result.category === 'sensitive' ? 'clinical' : result.category === 'service' ? 'commercial' : 'manual',
    action: result.priority === 'urgent' ? 'urgent_review' : 'draft_for_victoria',
    priority: result.priority,
    subject: result.subject,
    draft: result.text,
    issues,
  };
}

export type FollowUpRecord = {
  reference: string;
  consentToFollowUp: boolean;
  lastProposalAt?: string;
  firstSessionAt?: string;
  lastSessionAt?: string;
  lastContactAt?: string;
  remindersSent: number;
  optedOut?: boolean;
};
export type FollowUpDraft = { reference: string; kind: 'proposal' | 'first_session' | 'cycle' | 'reactivation'; text: string; approvalRequired: true };

/** Agent 4: generates drafts only; never messages customers. */
export function proposeFollowUps(records: readonly FollowUpRecord[], now: Date): FollowUpDraft[] {
  const elapsed = (value?: string) => {
    if (!value) return -1;
    const ms = Date.parse(value);
    return Number.isFinite(ms) && ms <= now.getTime() ? (now.getTime() - ms) / 86400000 : -1;
  };
  const result: FollowUpDraft[] = [];
  for (const item of records) {
    if (!item.consentToFollowUp || item.optedOut || item.remindersSent >= 2) continue;
    let kind: FollowUpDraft['kind'] | null = null;
    if (elapsed(item.firstSessionAt) >= 1 && elapsed(item.firstSessionAt) < 2) kind = 'first_session';
    else if (elapsed(item.lastProposalAt) >= 2 && elapsed(item.lastProposalAt) < 3) kind = 'proposal';
    else if (elapsed(item.lastSessionAt) >= 0 && elapsed(item.lastSessionAt) < 1) kind = 'cycle';
    else if (elapsed(item.lastContactAt) >= 60 && elapsed(item.lastContactAt) < 61) kind = 'reactivation';
    if (!kind) continue;
    const texts = {
      proposal: 'Hola, ¿cómo estás? ¿Pudiste mirar la propuesta? Si tenés dudas, lo conversamos sin apuro.',
      first_session: 'Hola, ¿cómo te sentiste después del encuentro? Si tenés dudas, podés contármelas.',
      cycle: 'Hola, completamos esta etapa de cuidado. Si te parece, podemos conversar cómo te sentís y cuáles serían los próximos pasos.',
      reactivation: 'Hola, ¿cómo estás? Si querés retomar una orientación, estoy a disposición.',
    };
    result.push({ reference: item.reference, kind, text: texts[kind] + '\n\nVictoria | Victoriosas', approvalRequired: true });
  }
  return result;
}

export type ContentDraft = { topic: string; format: 'carrusel' | 'post' | 'reel'; copy: string; approvalRequired: true };
/** Agent 5: editorial proposals, not publishing. */
export function weeklyContentDrafts(): ContentDraft[] {
  return [
    { topic: 'Evaluación inicial remota', format: 'carrusel', copy: 'Todo empieza con escucharte. Conocé cómo funciona la evaluación inicial remota de Victoriosas. Consultanos.', approvalRequired: true },
    { topic: 'Cuidado facial responsable', format: 'post', copy: 'Cada piel necesita atención propia. Conversamos sobre tus objetivos y definimos los siguientes pasos sin prometer resultados. Consultanos.', approvalRequired: true },
    { topic: 'Bienestar y relajación', format: 'reel', copy: 'Una pausa para vos. Descubrí nuestros cuidados de bienestar y masaje, siempre con orientación personalizada. Conversemos.', approvalRequired: true },
  ];
}

export type AggregateCase = { channel: 'web' | 'whatsapp'; status: 'waiting' | 'answered' | 'escalated'; service?: string; firstReplyMinutes?: number };
/** Agent 6: aggregate only. No names, phone numbers, emails or message bodies. */
export function consultationWeeklyReport(rows: readonly AggregateCase[]) {
  const counts = { total: rows.length, web: 0, whatsapp: 0, waiting: 0, answered: 0, escalated: 0 };
  const services: Record<string, number> = {};
  let replySum = 0, replyCount = 0;
  for (const row of rows) {
    counts[row.channel]++;
    counts[row.status]++;
    if (row.service) services[row.service] = (services[row.service] ?? 0) + 1;
    if (typeof row.firstReplyMinutes === 'number' && Number.isFinite(row.firstReplyMinutes) && row.firstReplyMinutes >= 0) {
      replySum += row.firstReplyMinutes;
      replyCount++;
    }
  }
  return { ...counts, averageFirstReplyMinutes: replyCount ? Math.round(replySum / replyCount) : null, services };
}
