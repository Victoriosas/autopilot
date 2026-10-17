# Beauty: evidencia y límites

## Pruebas realizadas

- RED inicial: módulo beautyRequests ausente. GREEN: contratos de validación y enlaces WhatsApp sin datos personales.
- HTTP: consentimiento, rechazo de campos sensibles, errores de DB honestos, cross-site bloqueado, administración sin token denegada.
- Frontend ejecutado en VM: reintento con misma referencia, bloqueo de cambio de servicio durante guardado, error sin falsa recepción, copia solo de referencia. No sustituye navegador ni DB real.
- PostgreSQL desechable: 7/7, permisos reales, RLS/admin/cliente, estados, límites por contacto, expiración y HTTP respaldado por filas reales. Auth HTTP de esta prueba es fixture; no Supabase Auth real.
- Navegador Chrome, servidor loopback sin dotenv ni credenciales: selección de facial, ficha con datos sintéticos, consentimiento y revisión; registro bloqueado al estar deshabilitado. Desktop y móvil 390x844 sin desbordamiento horizontal observado. Capturas `.audit/beauty-qa/desktop-summary.png` y `mobile-summary.png`. No se enviaron mensajes ni datos reales.
- Tipos, suite Node y builds completos ejecutados. Primer intento falló al cargar Get-FileHash en PowerShell heredado; corregido solo el PSModulePath del proceso. La prueba offline existente pasó después, sin cambiar su script.
- Revisión independiente: corregidos teléfono sin dígitos, UUID nuevo en revisión repetida y cambios durante POST; timeout añadido.

## Pendiente

Workflow `Isolated Beauty Supabase` prueba Auth real, PostgREST, RLS, POST, replay, listado y transición con cuentas sintéticas exclusivamente en 127.0.0.1:54321. Preparado; resultado remoto debe consultarse para el SHA concreto. Una prueba preparada no es evidencia aprobada.

No se probó solicitud real contra Supabase alojado, envío real de WhatsApp, recepción por Sofía, agenda Calendar, correo, pago ni turno contratado. No hay datos comerciales suficientes. La producción no está habilitada para este módulo.


## Continuación y correcciones de CI

- Core del SHA 1845ca1 detectó inventario de migraciones desactualizado (25 archivos vs 24 esperados). Se revisó el mapa y se incorporaron explícitamente beauty_requests y beauty_retention: 26 locales, sin cambiar el inventario alojado de 21 ni ejecutar reconciliación. Prueba de historial local aprobada.
- Retención preparada: función admin-only sin parámetros de fecha, solo DELETE de vencidas; PostgreSQL aislado ampliado a 8/8, sin ejecución real alojada. Su instalación tampoco programa borrados.
- Preview del SHA 1845ca1 READY: https://autopilot-mduzqni6m-autopilot12.vercel.app/servicios-sofia.html . Conector autorizado confirmó HTML y JavaScript HTTP200; /api/beauty/config 200 devuelve requestsEnabled=false. No confundir preview con publicación productiva ni comprobar solo el HTML como prueba de UI completa.
- Producción consultada nuevamente: health y configuración Mercado Pago HTTP200; commit a85a59b, checkoutEnabled=false, checkoutRequested=false, configured=false. Sin promoción.

## Evidencia final del bloque 17/10/2026

- Código funcional f58ba9c: Core v4 push 39068578819 y PR 39068582833 success. Node CI: 174 aprobadas de 175, una omitida exclusiva de Windows; local 175/175 sin omitidas. Builds, PostgreSQL comercio 13/13, inventario y replay aprobados.
- Integración Beauty Supabase real, SHA fc6115a: run 39068457508 success, 5/5 incluyendo suite; Auth real, HTTP, PostgREST, RLS, idempotencia, admin y RPC de retención sin filas vencidas. Stack desechable apagado. Los cambios posteriores f58ba9c son coordinación, aviso y documentación; no modifican router, migraciones ni prueba Supabase.
- PostgreSQL Beauty local 8/8, incluida eliminación de solo registros sintéticos vencidos; HTTP de esa suite usa auth fixture, diferenciada de la prueba Supabase de CI.
- Paquete offline `.audit/beauty-release-review/manifest.json`: dos migraciones con hashes, requisitos y reversión de aplicación. No es respaldo de datos ni aprobación. `scripts/prepare-beauty-release.mjs` no tiene clientes ni comandos de despliegue.
- Antes de datos reales: aprobación específica del alcance de migración/despliegue, respaldo/restauración, privacidad/retención operativa y revisión comercial de Sofía. Catálogo administrable y evaluación profesional separada siguen en roadmap, no se afirman terminados.

Siguiente instrucción: revisar PR #73 y sus evidencias, completar el catálogo administrable con estados y un paquete de aprobación comercial sin publicar servicios pendientes. No ejecutar SQL alojado, activar registros públicos, pagos ni producción hasta autorización específica. El último paso seguro de este bloque (paquete offline revisable) ya se ejecutó. No duplicar scheduler ni repetir mensajes sin cambios.

## Ciclo catálogo y evaluación privada

- PostgreSQL real desechable: 9/9, evidencia local `C:/Users/micahael/AppData/Local/Temp/victoriosa-beauty-test-alr0kC`, cluster detenido. Gate owner-only false por defecto, RLS pública, versiones, snapshot no falsificable y conservado, consentimiento, ownership profesional, finalización y cascada de retención.
- Revisión independiente: corregidos permisos PATCH, acceso directo a publicación, disponibilidad pública, refresco/limpieza por sesión y contexto de ficha en CRM.
- Navegador Chrome: prueba sintética local de crear ficha sin tarifa, abrir evaluación, impedir guardado sin consentimiento, guardar borrador y finalizar en solo lectura; recuperación del registro finalizado. Vista de 390x844: sin overflow horizontal (ancho efectivo 375 y scrollWidth 375 por scrollbar), corregido ancho de referencia. Captura `.audit/beauty-evaluation-mobile.png`. El fixture visual simula permisos y almacena solo en memoria; no prueba Auth ni clientes reales.
- Página pública sintética: catálogo DTO → consulta → revisión → recibo y enlace WhatsApp con UUID, sin datos de la ficha. No se abrió ni envió WhatsApp. Tests VM cubren catálogo vacío/error/malformado y fallback legado únicamente con deshabilitación explícita.
- `npm run verify` local aprobado antes de ajustes finales menores de UI; TypeScript y checks finales se registran por SHA en CI. Tests Supabase reales ampliados preparados para CI, sin Docker/Podman local. No afirmar éxito de esa ampliación hasta comprobar el run.
- Siguiente bloque seguro ejecutado: generación offline de cuatro fichas pendientes en `.audit/beauty-commercial-review/services-pending.json`, duración de ejemplo marcada, tarifas nulas, sin aprobación ni publicación. Paquete SQL offline ahora incluye tres migraciones con hashes; no es respaldo ni autorización.
