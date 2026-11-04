# F1 | Evidencia de recepción sintética real y frontera de aprobación
Fecha de ejecución: **2026-11-04**, UTC. Incidente de disponibilidad previo: `docs/CONSULTATION_F1_RESTORATION_20261104.md`.

## Alcance y límites
Se ejecutó **un solo caso técnico sintético controlado** en `https://victoriosas.online/consultanos`, con nombre y teléfono ficticios, cuenta de prueba propia, servicio `orientacion`, consentimiento de consulta y **sin consentimiento de IA**. No hay pacientes, tratamientos, información clínica ni comunicación a clientas reales. Se utilizó Chrome por Playwright con perfil efímero y se mantuvo cerrado cualquier POST ajeno a la API de consultas. La evidencia privada y capturas se guardaron fuera de Git en el equipo autorizado.

## Resultado en producción (evidencia observada)
| Etapa | Resultado |
|---|---|
| GET página y configuración | HTTP 200, `enabled=true`, privacidad `consultation-v1` |
| Formulario real | Un POST HTTP **202** y confirmación visible de recepción |
| Repetición exacta del mismo payload y UUID | HTTP **202**; no se abrió un nuevo expediente |
| Registro persistente | **1** fila del caso, identificador `22e86928-6fac-47e1-b250-f5da182a27c5`, marcador sintético presente y `aiConsent=false` |
| Outbox privado de aviso | **1** registro, `accepted_at` no nulo, proveedor identificado |
| Resend, aviso interno | Estado **delivered** para un correo de aviso, con referencia coincidente, desde dominio verificado y hacia casilla operativa |
| Respuestas supervisadas de este caso | **0** registros; no se hizo envío al correo de prueba |
| Seguridad admin sin sesión | POST `/api/beauty/inquiries/admin/:id/approve-send` denegado con **HTTP 401** |
| PostgreSQL desechable | `node scripts/test-consultation-postgres.mjs`: **12/12** pruebas aprobadas; clúster temporal detenido |
| Código / variables / base de datos | Sin modificaciones manuales de esquema, credenciales, permisos, flags o código de aplicación. La creación del caso y envío del aviso sí son efectos esperados del formulario real |

La recepción en Resend está acreditada según la señal del proveedor **delivered**. No hay verificación independiente de apertura ni lectura por humanos del correo de notificación. El caso de prueba se conservará conforme a la retención configurada; no ejecutar limpieza destructiva para ocultar evidencia.

## Por qué F1 todavía no está cerrada
El envío de una respuesta de prueba está protegido por un JWT de usuario de Supabase con perfil `admin` y aprobación explícita desde la bandeja. El correo Gmail conectado a las herramientas **no corresponde a un perfil administrador** según comprobación agregada de roles. No se creó un segundo administrador, no se extrajeron credenciales del navegador, no se emitió un token impersonado, no se modificó la tabla de outbox para simular aprobación y no se llamó a Resend para falsificar una respuesta del circuito.

**Falta:** entrar con la sesión administrativa real en `https://victoriosas.online/admin`, localizar la referencia del caso técnico en **Consultas**, revisar el borrador, aprobar conscientemente una sola respuesta al buzón de prueba controlado y verificar `reply-status`/outbox + entrega Resend + recepción en el buzón conectado. Hasta entonces: **F1 recepción real PROBADA; respuesta administrativa real PENDIENTE**.

El test de navegador y PostgreSQL aislados prueba seguridad, aceptación, idempotencia y reten­ción. No sustituye el requisito de revisión humana del recorrido productivo. La detección de fallos de Cloudflare ya está cubierta en la automatización de vigilancia existente. Nada de esto acredita autonomía 24/7 de agentes, WhatsApp entrante ni aprobación profesional de tratamientos.
