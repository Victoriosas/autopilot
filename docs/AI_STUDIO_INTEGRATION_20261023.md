# Victoriosas: integración de Google AI Studio

Solicitud del propietario del 23/10/2026: estudiar la aplicación abierta, adaptar `autopilot (2).zip` al proyecto y Supabase existentes, subir a GitHub y desplegar en Vercel.

## Fuente y alcance

- ZIP SHA256: `b9dba83efb632faa7e7a974b58d8ee062e5b057fb7280ef82bf21e7ff4681f14`.
- Inventario: 495 entradas, 17.175.873 bytes sin comprimir; rutas de extracción comprobadas. Fuente extraída fuera de Git, sin ejecutar scripts del adjunto ni importar su entorno.
- Referencia: aplicación AI Studio `9fcff751-f54b-4dfd-943c-c6629b7fbb0b`. El cambio basado en Figma fue cancelado por el propietario.
- Se integran las mejoras existentes de consultas de #105 y descubrimiento de #106 sobre `fb1f4f5`, sin restaurar el backend antiguo del ZIP.

## Resultado

- Acabado marfil/dorado, sombras suaves, botones satinados y tarjetas del prototipo. Se conservan fuentes, portada, identidad, contactos y textos aprobados. Dos imágenes del ZIP acompañan el regalo y el hub editorial.
- Menú con buscador y orientador en todas las rutas públicas, cabecera adaptada antes del ancho que desbordaba en AI Studio. Diálogos nativos con foco, Escape y fondo inerte.
- Buscador de los 17 tratamientos: texto sin distinción de tildes, filtros con conteos, estados vacíos, enlaces exactos y pequeños gestos de autocuidado sin instrucciones clínicas. Los artículos en borrador solo aparecen en revisión.
- Orientador de tres preguntas: área, interés específico y modalidad. Conserva el tratamiento y la modalidad en WhatsApp/email, permite volver y reiniciar, enlaza la ficha y `/consultanos`. No diagnostica ni elige una técnica automáticamente. El resultado no anuncia «Paso 4 de 3» y la asesoría online independiente continúa marcada como no disponible.
- Regalo con destinatario, remitente opcional, experiencia, dedicatoria, sugerencias, vista previa, copia y mensajes editables. Descarte al cerrar. No emite vouchers, acredita compras ni confirma reservas.
- Guía de tres rituales con impresión/guardado a PDF desde el navegador. Se reutilizan textos generales ya aprobados; se excluyen consejos clínicos añadidos por el prototipo.
- `/consultanos`, su API y bandeja privada conservan validación, idempotencia, RLS, retención y controles de disponibilidad de #105.
- Se reemplaza el falso éxito de la newsletter que usaba `localStorage` por una sección que comunica que las suscripciones no están abiertas y prepara una consulta por email. No se captura correo, crea una lista ni se promete un alta inexistente.

## Verificación local

- `npm run verify`: 243/243 pruebas, cero omitidas, TypeScript, build de aplicación y build de Vercel aprobados. Build de Vercel repetido después de los ajustes visuales finales.
- PostgreSQL 18 desechable: 8/8 pruebas de consultas, concurrencia, cuota, deduplicación, permisos y borrado. Entorno detenido. No equivale a prueba alojada.
- Playwright/Edge y axe: 24 vistas de páginas a 1440/1137/768/390/360/320 y 20 vistas de diálogos a 1440/768/360/320, sin overflow, imágenes rotas, errores JavaScript ni infracciones automatizadas detectadas. Se corrigió contraste del resultado durante la revisión.
- Se comprobaron filtros, búsqueda vacía, contexto por ambos canales, reinicio, barrera de asesoría online, descarte del regalo, Escape y recuperación de foco. Ningún mensaje enviado.
- PDF A4 de una página con los tres rituales completos; extracción de texto y revisión visual. No imprime navegación ni acciones del diálogo.
- HTML inicial, rutas, assets, sitemap, escaneo de secretos y `git diff --check` aprobados.
- Evidencias locales: `output/playwright/ai-studio-*`; no contienen datos de clientes. Capturas y logs de herramientas permanecen fuera de la entrega de código.

## Supabase y configuración alojada

Revisión de solo lectura del proyecto **victoriosa-autopilot**, `jfjzpwlrhzqbcrvqxhzf`, el 23/10/2026:

- Estado `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.166. Las 33 tablas públicas tienen RLS.
- Hay 25 migraciones registradas. La migración de consultas `20261023042129_consultation_private_outbox.sql` todavía no está aplicada y sus RPC no existen alojadas. El historial local tiene versiones antiguas distintas: no ejecutar un `db push` masivo.
- No existen tablas de newsletter; `storefront_waitlist` corresponde a avisos de lanzamiento y no se reutiliza como consentimiento para campañas.
- Vercel contiene nombres de variables de conexión Supabase. No contiene la configuración `CONSULTATION_*` ni `RESEND_API_KEY`; no se imprimieron secretos ni se cambiaron credenciales.
- El advisor conserva avisos previos: 14 tablas con RLS sin políticas (cerradas para clientes), permisos de ejecución de `beauty_evaluation_validate()` y `beauty_purge_expired_requests()`, y protección de contraseñas filtradas desactivada. No se ampliaron permisos para silenciar avisos.
- El advisor de rendimiento informa además 67 índices sin uso y 8 grupos de políticas permisivas múltiples. Son hallazgos previos; no se borran índices ni políticas durante una integración visual.
- Referencias de los avisos: [funciones anónimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funciones autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Pendientes para abrir recepción de consultas: migración individual revisada y aplicada con autorización específica, proveedor/remitente verificados, privacidad y responsable de atención aprobados, limpieza periódica comprobada y recepción real del aviso. Para newsletter: consentimiento separado, persistencia, confirmación/baja y operación real. El diseño no afirma que estos circuitos estén operativos.

## Publicación y recuperación

Publicar mediante una PR de integración y el despliegue Git de `main`, después de verificar `validate`, `postgres`, la integración aislada y la vista previa del SHA exacto. No promover un artefacto de Preview: sus borradores están habilitados. La producción debe construirse de nuevo con sus controles cerrados.

Comprobar en `https://victoriosas.online`: SHA del merge, rutas y recursos 200, borradores 404, rutas comerciales retiradas 410, `checkoutEnabled=false`, consultas `enabled=false` y administración anónima 401. Los resultados alojados finales se registran en continuidad al verificarse.

Recuperación: revertir el merge por Git y permitir el nuevo build de producción. No hay migraciones ni escrituras SQL remotas ni cambios de credenciales que revertir en esta integración. No se modifican DNS, pagos, catálogo comercial ni campañas; no hay datos reales suficientes para atribuir ventas o mejoras porcentuales.


## Evidencia alojada de la integración

La [PR #107](https://github.com/Victoriosas/autopilot/pull/107) se integró el 23/10/2026 a las 18:47 de Uruguay. Al incluir sus commits, #105 y #106 quedaron fusionadas también. SHA de producción funcional: `26e54e98aa7efb0b854c03ef7b5c704ee41c1225`; deployment `dpl_Gtw8PaTGAxPwmo7tiJ4hcuCErLvB`, `READY`, contexto `production`, generado por Git de main.

- PR: validate/postgres y CodeQL aprobados; integración aislada Auth/PostgREST/RLS aprobó 5 + 6 + 5 pruebas y se detuvo. La integración aislada no aplica la migración en el proyecto alojado.
- Main: CI `40029302622` validate/postgres aprobada e integración aislada `40029302619` aprobada sobre `26e54e9`.
- Preview protegido de `de760c4`: 20 vistas de diálogos en navegador, sin errores JavaScript ni infracciones automatizadas; contexto, foco, reinicio y descarte aprobados. Config de consultas deshabilitada y administración anónima 401.
- Dominio público: 20 vistas de diálogos aprobadas, sin envíos. Rutas públicas y `/consultanos` 200; recursos nuevos 200; borradores 404; rutas comerciales retiradas 410; checkout/Beauty/catálogo cerrados; consultas `enabled=false`; bandeja anónima 401.
- La ampliación de QA a `/consultanos` detectó contraste insuficiente del rótulo pequeño sobre el nuevo fondo. El cierre visual cambia ese rótulo al dorado oscuro ya existente. Tras corregirlo, 30 vistas locales de cinco rutas a 1440/1137/768/390/360/320 aprobaron axe, imágenes, overflow y errores JavaScript. El resultado final del despliegue de esta corrección se registra en la PR de cierre y en la entrega al propietario.

No hay métricas comerciales reales suficientes. No se realizaron envíos, capturas de clientes, activación de formularios, campañas, cambios de pagos o escrituras en Supabase.
