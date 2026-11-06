# F1 · Restauración de disponibilidad de /consultanos (2026-11-04)

## Alcance y diagnóstico
En producción, la portada de consultas y los endpoints GET `/api/health` y `/api/beauty/inquiries/config` devolvían HTTP 403 con HTML de verificación de Cloudflare, pese a que Vercel estaba READY y el formulario ya conservaba las cookies `same-origin` (#176). La configuración de seguridad de la zona aplicaba un desafío global. Los checks locales exitosos no demostraban que el público pudiera consultar el formulario.

## Cambio de configuración externo
Se corrigió **únicamente** el nivel global de desafío para mantener un nivel de protección elevado sin desafiar de forma indiscriminada a todas las visitas. La lectura posterior confirmó el ajuste. No se desactivaron las protecciones contra bots ni la verificación de integridad del navegador; tampoco se cambiaron DNS, rutas, identidad, permisos, variables, mensajes, SQL ni código de aplicación.

El detalle operativo y las instrucciones de reversión están en el registro local de operaciones y no se publican en Git. Si existen señales de ataque real, revisar eventos de seguridad antes de volver a cambiar este nivel. Un desafío general vuelve a afectar la disponibilidad del formulario.

## Evidencia posterior
- **GET público desde PC autorizada:** `/`, `/consultanos`, `/api/health` y `/api/beauty/inquiries/config` devolvieron HTTP 200 con respuestas del tipo esperado; `/api/beauty/inquiries/admin` sin sesión devolvió HTTP 401.
- **Contrato de la API:** `enabled=true`, `privacyVersion=consultation-v1`, `retentionDays=30`; health `status=ok`, `runtime=vercel`, `commit=a872b4b7540b138a9d59b45e492758121f2c9a55`.
- **Chrome real de solo lectura:** escritorio 1280 px y móvil emulado 390 px; título correcto, selector de tratamientos, botón `Enviar consulta` habilitado, sin mensaje `sin conexión` ni errores JavaScript. El navegador bloqueó todas las solicitudes POST; no envió consultas. Capturas y resultado JSON se conservan solo en la PC de operaciones.
- **Fixture loopback:** `scripts/test-consultation-form-browser.ts` aprobó en 1280/390 px: cookie, consentimiento, origen, bloqueo seguro y reintento, con datos y transporte simulados.
- **Smoke existente:** `node scripts/public-health.mjs` finalizó con código 0 y comprobó las rutas públicas, las API, el rechazo de acceso administrativo anónimo y las puertas comerciales cerradas.
- **Git:** `main` local limpia y alineada con `origin/main`, sin modificar trabajo en ramas Codex.

## Puerta F1: situación real
**Disponibilidad de GET y renderizado: PROBADOS.** El cierre de F1 todavía requiere un recorrido de recepción y respuesta con sesión administrativa legítima, persistencia, idempotencia y entrega a destinatario de pruebas controlado. Esta intervención **no** hizo POST al sitio público, no leyó expedientes y no verificó entrega real de Resend/Gmail/WhatsApp. No declarar «Autopilot autónomo» ni «F1 completa».

## Continuación
1. Vigilar GET y contrato mediante el workflow `Victoriosas Public Health` y la vigilancia existente, diferenciando desafío Cloudflare de fallo de aplicación.
2. Probar con identidad administrativa autorizada y canales de prueba controlados, sin clientas reales.
3. Mantener F2 conocimiento profesional revisado, F3 laboratorio sintético y F4 recepción supervisada en secuencia.
4. Tratar issue #180 (Supabase Preview asociada a proyecto histórico) como incidencia independiente.

No incluye cambios de código ni de configuración remota desde GitHub.
