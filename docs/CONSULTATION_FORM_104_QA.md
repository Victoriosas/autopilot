# Consultas web: implementación y verificación de #104 / PR #105

Fecha: 23/10/2026. Modo: desarrollo y revisión; envío público cerrado.

## Problema y resultado

La implementación inicial fallaba al importar el formulario desde Node porque accedía a `import.meta.env` sin Vite. Además, no tenía persistencia para reintentos ni límites durables de abuso. El formulario ahora utiliza `/consultanos` y `/api/beauty/inquiries`, con disponibilidad consultada al backend antes de mostrar campos. Si falta preparación, ofrece WhatsApp y el Gmail oficial.

Nombre y celular obligatorios; correo y edad opcionales, salvo correo al elegir respuesta por email. Diecisiete servicios conservan su contexto en el fragmento de URL; ningún dato personal viaja en la URL. Mensaje breve de texto, consentimiento explícito, sin historia clínica ni fotos. El formulario acepta saltos de línea y limita tamaño, campos y contenido. Mantiene un solo identificador y los mismos datos al reintentar un envío incierto, sin almacenamiento persistente en el navegador.

El servidor valida origen HTTPS configurado, JSON de hasta 4 KiB, honeypot y una huella HMAC de conexión. Un límite de cinco consultas nuevas por hora y dirección se aplica en PostgreSQL, compartido por todos los workers. Dentro de Vercel se utiliza su cabecera sobrescrita; fuera del runtime se ignoran cabeceras IP enviadas por el cliente. No se modificó la configuración global de proxies.

La base concede una sola autorización temporal para notificar por consulta. El aviso usa una clave estable de idempotencia y lleva solo la referencia; los datos se revisan en una bandeja privada de `/admin`, con Auth real, rol administrador y RLS del solicitante. No se declara aceptación hasta guardar tanto la consulta como la aceptación del proveedor. Un aviso aceptado por el proveedor no prueba entrega en Gmail ni respuesta humana.

## Garantías y evidencia TDD

| Garantía | Evidencia RED | Evidencia GREEN |
| --- | --- | --- |
| Importación en Node y formulario cerrado | `542a38e`: TypeError reproducido | `4522425`, `consultationForm.test.ts` |
| Texto multilínea y controles rechazados | `542a38e`: validación rechazaba saltos de línea | `4522425`, `consultationRequest.test.ts` |
| Concurrencia, límite durable, privacidad y retención | `fefac87`: funciones/esquema ausentes | `consultation-postgres.test.ts`, 8/8 en clúster desechable |
| Bandeja con identidad administrativa | `576686d`: devolvía 404 en vez de exigir autorización | `consultationRouter.test.ts`; Auth/PostgREST reales en CI |
| IP confiable solo en Vercel | `6a24266`: función ausente | `9b4a47b`, prueba de cabeceras falsas y múltiples |
| Móvil a 320 px | QA detectó título desbordado | `9b4a47b`, captura y repetición sin overflow |

`npm run verify`: 236/236 pruebas sin omisiones, TypeScript y ambos builds aprobados en Windows. El PSModulePath se ajustó solo en el proceso de verificación, sin configuración del sistema. `check-route-html.mjs`, escaneo de valores secretos y `git diff --check` aprobados. La cobertura focalizada local observada fue 91,85% de líneas y 80% de ramas; no es cobertura global ni de toda la UI.

`node scripts/test-consultation-postgres.mjs`: 8/8, PostgreSQL 18 real, datos sintéticos, clúster detenido. Incluye ocho reclamaciones concurrentes, una sola autorización de envío, reintentos, conflicto de contenido, permisos, acceso por RLS y borrado en cascada. El fixture también admite los roles que ya existen en el clúster compartido de CI.

CI aislada inicial: [39981225237](https://github.com/Victoriosas/autopilot/actions/runs/39981225237), aprobada: consultas 5/5 con Auth, PostgREST y RLS reales, más suites Beauty anteriores. Correos simulados; stack detenido. El trabajo `postgres` inicial encontró roles existentes en el fixture y se corrigió en `9b4a47b`. Antes de integrar, deben aprobarse `validate`, `postgres` y `beauty-stack` del SHA final de [PR #105](https://github.com/Victoriosas/autopilot/pull/105). Supabase Preview omitido no prueba un entorno alojado.

QA Playwright/Edge y axe: formulario cerrado y fixture habilitado a 1440/768/390/320 px, ocho vistas sin overflow, imágenes rotas, errores JS ni infracciones automatizadas. Se comprobó selección contextual, email opcional/obligatorio según canal, consentimiento y reintento con cuerpo/UUID idénticos. Capturas locales en `output/playwright/form105-*.png` y resultados `form105-browser-results.log`. Fixture de navegador simulado; la autorización de base se prueba en CI real desechable. No se inspeccionaron datos de clientes ni una sesión humana real.

HTML inicial y rewrites de `/consultanos` con/sin barra preparados, canonical propio y noindex en preview. El preview inicial `dpl_DF84Ebn1r7m2gX4SFuUwRpA49iuR` estuvo READY en `64cab51`; su configuración HTTP real confirmó `enabled:false`, versión de privacidad y `Cache-Control:no-store`. Comprobar el preview del SHA final antes de integrar.

## Configuración y límites antes de activar

La migración `20261023042129_consultation_private_outbox.sql` es aditiva y está preparada offline. No se aplicó a Supabase alojado. Conserva consultas por 30 días, oculta vencidas y ofrece `consultation_purge_expired()` para borrado de consultas/avisos y limpieza de huellas antiguas. Debe revisarse, respaldarse y autorizarse individualmente; no ejecutar un `db push` general sobre el historial divergente existente.

Preparación requerida:

- Proveedor transaccional autorizado, remitente verificado del dominio y recepción real comprobada en `victoriosas.online@gmail.com`. No se crearon cuentas, planes pagos ni registros DNS.
- Revisar y aprobar privacidad, consentimiento, responsable humano, identidad administrativa y procedimiento de eliminación. El texto público describe el flujo solo cuando esté habilitado.
- Configurar y verificar ejecución periódica de `consultation_purge_expired()` y monitorizar su éxito antes de declarar retención operativa. La migración no instala cron ni concede acceso público a limpieza.
- Servidor: `PUBLIC_APP_URL`, `CONSULTATION_ABUSE_SECRET` (mínimo 32 caracteres), configuración Supabase de servidor y `CONSULTATION_MAIL_PROVIDER=resend`, `CONSULTATION_MAIL_FROM`, `CONSULTATION_MAIL_TO`, `RESEND_API_KEY`. Ningún secreto en variables `VITE_*`.
- Gates por defecto cerrados: `CONSULTATION_REQUESTS_ENABLED`, `CONSULTATION_PRIVACY_APPROVED`, `CONSULTATION_RETENTION_READY`, `CONSULTATION_MAIL_ENABLED`. Solo habilitarlos tras completar la preparación y autorización correspondiente.
- Reintentos inciertos: máximo 23 horas, con margen frente a las 24 horas de idempotencia del proveedor. Los avisos aceptados no se reenvían durante la vida de la consulta. Tras purgar una consulta expirada no se promete deduplicación indefinida. No hay un worker de reenvío automático: los reintentos proceden del mismo formulario y las consultas registradas permanecen visibles en la bandeja.
- El límite por IP puede agrupar usuarios de una misma red; no sustituye todos los controles contra bots distribuidos. Debe medirse al activar.

Referencias técnicas verificadas: [funciones y permisos Supabase](https://supabase.com/docs/guides/database/functions), [idempotencia Resend](https://resend.com/docs/dashboard/emails/idempotency-keys), [cabeceras Vercel](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for). Changelog Supabase consultado; el próximo cambio TLS anunciado no altera este contrato.

## VICTORIOSAS AUTOPILOT — REPORTE CICLO

Fecha: 23/10/2026. Ciclo: manual, tarea #104. Modo: preparación verificable de PR.

1. Estado general: web publicada estable en `fb1f4f5`; formulario nuevo solo en rama/preview y cerrado. Catálogo, checkout y demás gates comerciales conservados. Riesgo residual: configuración y operación humana pendientes.
2. Cambios: formulario, API, bandeja privada, migración offline y pruebas. Objetivo: recibir consultas con contexto y manejar fallos sin falsas confirmaciones.
3. Mejoras comerciales: contacto propio y alternativa WhatsApp/email; impacto en conversión aún no medido. No se cambiaron tarifas, servicios aprobados ni mercados.
4. Métricas: no hay datos reales suficientes todavía de ventas, sesiones, conversión, add to cart, checkout o ticket promedio.
5. Próximo plan: revisar PR y configuración autorizada; aprobar privacidad/retención y destinatario humano; comprobar recepción real antes de activar.
6. Bloqueos: activación requiere proveedor y remitente verificables, revisión de privacidad, rutina de borrado operativa y autorización específica de migración/publicación. Sin pagos, compras, campañas, mensajes reales, SQL alojado ni cambios de producción.
7. Verificación: formulario desktop/tablet/mobile y rutas estáticas comprobados; producto/carrito/checkout siguen fuera del alcance público activo. Recepción real en Gmail pendiente, sin presentarla como operativa.
