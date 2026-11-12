export type ConsultationUnavailableReason = 'disabled' | 'configuration_incomplete' | 'notification_unavailable' | 'storage_unavailable' | 'storage_timeout';
export type ConsultationReadiness = { enabled: boolean; unavailableReason: ConsultationUnavailableReason | null };
export const CONSULTATION_READINESS_TIMEOUT_MS = 3000;

/** Read-only policy: no admission, notifications, models or private error details. */
export async function checkConsultationReadiness(deps: {
  enabled(): boolean; configured(): boolean; notificationReady(): boolean; storageReady(signal: AbortSignal): Promise<boolean>;
}, timeoutMs = CONSULTATION_READINESS_TIMEOUT_MS): Promise<ConsultationReadiness> {
  const closed = (reason: ConsultationUnavailableReason): ConsultationReadiness => ({enabled:false,unavailableReason:reason});
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > CONSULTATION_READINESS_TIMEOUT_MS) return closed('configuration_incomplete');
  try {
    if (deps.enabled() !== true) return closed('disabled');
    if (deps.configured() !== true) return closed('configuration_incomplete');
    if (deps.notificationReady() !== true) return closed('notification_unavailable');
  } catch { return closed('configuration_incomplete'); }
  const controller = new AbortController();let timedOut=false;
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<ConsultationReadiness>(resolve => {
    timer=setTimeout(()=>{timedOut=true;controller.abort();resolve(closed('storage_timeout'));},timeoutMs);
  });
  const storage = Promise.resolve().then(()=>deps.storageReady(controller.signal)).then(ready => timedOut ? closed('storage_timeout')
    : ready===true ? {enabled:true,unavailableReason:null} : closed('storage_unavailable')).catch(()=>closed(timedOut?'storage_timeout':'storage_unavailable'));
  try {return await Promise.race([storage,expired]);} finally {clearTimeout(timer!);}
}
