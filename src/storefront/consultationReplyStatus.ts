// Legacy `sent` means provider acceptance, not delivery or human receipt.
// Unknown history must never enable another send.
export function consultationReplyStatus(payload: unknown) {
  const unknown = { canApprove: false, accepted: false, label: 'Historial sin confirmar. Actualizá antes de enviar.' };
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'reply')) return unknown;
  const reply = (payload as { reply: unknown }).reply;
  if (reply === null) return { canApprove: true, accepted: false, label: 'Sin respuesta por correo registrada' };
  if (!reply || typeof reply !== 'object') return unknown;
  switch ((reply as { state?: unknown }).state) {
    case 'sent': return { canApprove: false, accepted: true, label: 'Correo aceptado por Resend. Entrega y recepción humana sin confirmar.' };
    case 'sending': return { canApprove: false, accepted: false, label: 'Envío en proceso: verificá antes de actuar' };
    case 'failed_unknown': return { canApprove: false, accepted: false, label: 'Entrega incierta: revisar Resend, no reenviar automáticamente' };
    default: return unknown;
  }
}
