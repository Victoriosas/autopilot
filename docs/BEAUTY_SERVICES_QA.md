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
