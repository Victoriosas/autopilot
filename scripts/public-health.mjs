import { pathToFileURL } from 'node:url';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

// GET requests only. No customer data, login, purchases or provider mutations.
export async function checkPublicHealth(origin, request = fetch) {
  async function get(path, status = 200) {
    const response = await request(new URL(path, origin).href, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
    });
    if (response.status !== status) {
      // Never log response bodies or arbitrary headers: they could contain secrets.
      const challenged = response.status === 403 &&
        response.headers?.get?.('cf-mitigated')?.toLowerCase() === 'challenge';
      const diagnosis = challenged ? 'Cloudflare challenge confirmed' : 'cause not confirmed';
      // Log a Ray ID only when it matches Cloudflare's bounded format; omit colo and free text.
      const headerRay = response.headers?.get?.('cf-ray')?.trim();
      const ray = typeof headerRay === 'string' && /^[a-f0-9]{16}(?:-[a-z]{3,5})?$/i.test(headerRay)
        ? headerRay.slice(0, 16).toLowerCase() : null;
      const rayEvidence = ray ? `; cf-ray=${ray}` : '';
      requireCondition(response.status === status,
        `${path}: unexpected HTTP status: HTTP ${response.status} (expected ${status}); ${diagnosis}${rayEvidence}`);
    }
    console.log(`${path}: HTTP ${response.status}`);
    return response;
  }
  async function getJson(path) {
    const response = await get(path);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${path}: invalid JSON`);
    }
    requireCondition(body && typeof body === 'object' && !Array.isArray(body), `${path}: expected a JSON object`);
    return body;
  }
  for (const path of ['/', '/nuestros-servicios', '/consultanos', '/de-mi-para-ti', '/privacidad', '/robots.txt', '/sitemap.xml']) await get(path);
  for (const path of ['/tienda', '/checkout', '/tratamientos']) await get(path, 410);
  for (const slug of ['una-pausa-tranquila-para-vos', 'ordenar-tu-rutina-cosmetica']) await get(`/de-mi-para-ti/${slug}`, 404);
  const healthPath = '/api/health';
  const health = await getJson(healthPath);
  requireCondition(health.status === 'ok', `${healthPath}: invalid status`);
  requireCondition(typeof health.commit === 'string' && /^[a-f0-9]{40}$/.test(health.commit), `${healthPath}: invalid commit`);
  requireCondition(health.checkoutEnabled === false && health.checkoutRequested === false, `${healthPath}: checkout gates must be closed`);
  // This intake is already enabled independently of the closed Beauty/commerce gates.
  // Readiness checks do not submit data or prove human receipt of notifications.
  const consultationPath = '/api/beauty/inquiries/config';
  const consultations = await getJson(consultationPath);
  const reason = ['disabled','configuration_incomplete','notification_unavailable','storage_unavailable','storage_timeout'].includes(consultations.unavailableReason)
    ? consultations.unavailableReason : 'unknown';
  requireCondition(consultations.enabled === true, `consultation intake unavailable: ${reason}`);
  requireCondition(consultations.privacyVersion === 'consultation-v1', `${consultationPath}: invalid privacy version`);
  requireCondition(consultations.retentionDays === 30, `${consultationPath}: invalid retention period`);
  await get('/api/beauty/inquiries/admin', 401);
  const beautyPath = '/api/beauty/config';
  const beauty = await getJson(beautyPath);
  requireCondition(beauty.requestsEnabled === false, `${beautyPath}: requests gate must be closed`);
  const catalogPath = '/api/beauty/catalog';
  const catalog = await getJson(catalogPath);
  requireCondition(catalog.catalogEnabled === false, `${catalogPath}: catalog gate must be closed`);
  requireCondition(Array.isArray(catalog.services) && catalog.services.length === 0, `${catalogPath}: services must be empty`);
  const paymentsPath = '/api/payments/mercadopago/config';
  const payments = await getJson(paymentsPath);
  requireCondition(payments.configured === false && payments.checkoutRequested === false
    && payments.unavailableReason === 'CHECKOUT_DISABLED', `${paymentsPath}: checkout gates must be closed`);
  console.log('Consultation intake ready; anonymous inbox access denied. No form submitted or notification receipt verified.');
  console.log(`Public release healthy: ${health.commit}; commercial gates closed.`);
  return { commit: health.commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkPublicHealth('https://victoriosas.online');
}
