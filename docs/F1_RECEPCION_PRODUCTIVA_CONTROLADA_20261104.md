# F1 | Circuito productivo completo con caso sintético controlado
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
| Respuesta administrativa supervisada | **1** registro; `state=sent`, `approval_mode=human`, `approved_by` informado y destinatario de prueba exacto |
| Resend, respuesta aprobada | Envío **delivered** a la cuenta de prueba propia, con proveedor coincidente con el outbox |
| Gmail, cuenta de prueba | Mensaje nuevo en **INBOX**, asunto correcto y contenido idéntico al borrador revisado |
| Interfaz administrativa | Expediente exacto identificado, borrador seguro revisado y confirmación explícita del diálogo antes del envío |
| Seguridad admin sin sesión | POST `/api/beauty/inquiries/admin/:id/approve-send` denegado con **HTTP 401** |
| PostgreSQL desechable | `node scripts/test-consultation-postgres.mjs`: **12/12** pruebas aprobadas; clúster temporal detenido |
| Código / variables / base de datos | Sin modificaciones manuales de esquema, credenciales, permisos, flags o código de aplicación. La creación del caso y envío del aviso sí son efectos esperados del formulario real |

La recepción en Resend está acreditada según la señal del proveedor **delivered**. No hay verificación independiente de apertura ni lectura por humanos del correo de notificación. El caso de prueba se conservará conforme a la retención configurada; no ejecutar limpieza destructiva para ocultar evidencia.

## Cierre de la prueba integral: 21:07 UTC
Después de documentar la recepción inicial, el operador encontró en Chrome **una sesión administrativa ya autorizada** de `/admin`. La pantalla mostraba el expediente sintético exacto. Se verificó coincidencia entre referencia, nombre de prueba, buzón propio y borrador de orientación general antes de invocar `Preparar respuesta`. El botón `Aprobar y enviar por correo (Resend)` estaba dentro del mismo expediente. Se inspeccionó el diálogo de confirmación de la aplicación y se aceptó **una sola vez**, conforme a la autorización expresa del propietario para la prueba integral.

Verificación independiente de tres sistemas:
- Supabase `public.consultation_reply_outbox`: **una fila del caso** con `state='sent'`, `approval_mode='human'`, `approved_by IS NOT NULL`, `sent_at` presente y `provider_message_id` específico. La coincidencia del destinatario con el buzón controlado se comprobó sin publicar correos en el repositorio.
- Resend: identificador `01a1a863-7c6a-72ba-83b7-f6300ce8de4a` coincide exactamente con el outbox y figura **delivered**.
- Gmail conectado: mensaje nuevo de respuesta en el buzón de prueba, asunto y contenido del borrador verificados, sin adjuntos. No se marcó manualmente como leído.

**Conclusión:** para el caso técnico de producción, F1 queda **PROBADA DE EXTREMO A EXTREMO** (formulario, consentimiento, persistencia, idempotencia, notificación, revisión administrativa, aprobación, estado de envío, Resend y recepción Gmail). No requiere que la herramienta Gmail esté conectada con la identidad administradora, porque la aprobación se ejecutó desde una **sesión legítima preexistente de la web**. Nunca se crearon roles, usuarios ni sesiones, ni se extrajeron contraseñas, tokens o cookies.

## Límites y siguientes fases
- Una prueba canario no acredita que todos los visitantes, redes o sesiones no tengan fallos futuros. Mantener el monitor de Cloudflare y controles HTTP públicos.
- `public.consultation_case_states` no tenía una fila de estado manual para este caso al consultar después del envío; `consultation_reply_outbox.state='sent'` sí acredita la respuesta. Comprobar que el panel muestra correctamente este caso en **Contestadas** antes de automatizar cualquier cambio de estado.
- El correo del aviso al propietario figura entregado por el proveedor, no se comprobó lectura por una persona; la respuesta al buzón de prueba sí se recibió vía Gmail conectado.
- Nunca enviar mensajes reales automáticamente, no diagnosticar, no inventar resultados de tratamientos ni publicar promociones. La fase F2 exige revisión profesional de las 17 fichas; hoy siguen vacías. F3: inventario congelado de 40 casos/6 controles y 22 pruebas sintéticas aprobadas, **sin** evaluación de modelos remotos ni prueba de coste externo.
- La garantía de la prueba cubre **correo supervisado**, no WhatsApp entrante, agenda ni autonomía 24/7.
- El expediente sintético debe retenerse de acuerdo con la política de 30 días; no realizar borrado manual silencioso.
