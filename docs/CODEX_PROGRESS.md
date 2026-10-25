# Continuidad técnica de consultas · 2026-10-24 (Uruguay)

## Alcance y preservación

Autorización vigente: integrar, verificar y desplegar cambios técnicos reversibles; migraciones aditivas autorizadas. Sin tarifas, cobros, decisiones clínicas, exposición de datos ni nuevos envíos autónomos. Evaluación sintética: máximo US$3; no comprar créditos.

Worktree propio: `consultation-integration/autopilot`, rama `codex/consultation-integration-20261024`. Los originales de Claude, evaluación y `consultation-phase2` permanecen intactos, incluidos sus cambios sin commit. No se detectó proceso Claude activo. Se reutilizaron los commits de #129/#130/#131 y el trabajo existente de inteligencia en sombra; no se crearon agentes conversacionales duplicados.

## Inventario verificado al iniciar

- Funcional: main/producción `a8daca9`; consultas persistentes, consentimiento IA independiente, bandeja/campanita, estados de caso y lectura, outbox de respuesta y cron horario `consultation-retention-hourly`. Tablas de consultas con RLS; anon/authenticated sin permiso de purga. Correo general existente ya activo; IA camelRun apagada. La pestaña WhatsApp informa que falta integración entrante.
- Implementado y pendiente de validar conjuntamente: #129 evaluador/prompts/casos congelados, #130 CI segura, #131 gateway; inteligencia local con evidencia, persistencia/leases, aprobación exacta y seguimiento sin envío. CI original verde; Supabase Preview omitido corresponde a otro proyecto, no prueba el primario.
- Bloqueado o incompleto: evaluación real, modelo local instalado, procesamiento alternativo autorizado y costo verificable de APIs compatibles, recepción humana de correos, WhatsApp oficial entrante. No se consultan mensajes de clientas para QA.

## Implementación en curso

- Gateway común: Ollama loopback, camelRun sin estado y API compatible para pruebas. JSON, tokens, bytes, timeout, cancelación y redirects acotados; errores sin cuerpo del proveedor. Selección mediante configuración; ningún fallback remoto.
- Runtime sombra: comprensión determinista, extracción de fuentes publicadas vigentes, tres variantes, guardián y aprobación del texto exacto con expiración. Consentimiento IA antes de invocar cualquier modelo; riesgos y consultas vencidas no salen a modelos. Credenciales de sourcing separadas.
- Presupuesto: reserva atómica de US$0.06 por análisis remoto. Cada llamada acota contexto a 20k, salida a 2048 tokens, una respuesta y razonamiento apagado. El catálogo vivo debe respaldar la reserva conservadora de cinco respuestas más margen. `spendLimit` es un corte entre solicitudes, no un límite monetario intratoken; contrato correcto `{usd: ...}` según OpenAPI oficial.
- Evaluador: Haiku 5.5 sintético de menor costo, aislado del adaptador productivo. Preflight del catálogo; reserva máxima US$2.52 para 40 casos y seis controles, sin reinicios automáticos. Los ocho finales solo se ejecutan si desarrollo aprobó. Resultados incompletos, JSON parcial, estados contradictorios y fallos críticos bloquean el gate.
- CI de PR sin claves; evaluación real solo `workflow_dispatch` en main, sin rerun automático y con informe de siete días. Prompts finales no se ajustan tras ver el conjunto reservado.

## Evidencia y siguiente fase

`npm run verify`: 337/337, tipos y ambos builds aprobados antes del último ajuste exclusivo del inventario SQL. PostgreSQL 18 aislado: 10/10, incluido presupuesto concurrente, lease, CAS, RLS y purga. Inventario conserva versiones locales/alojadas divergentes: no usar `db push`. Verificar nuevamente las pruebas SQL tras cualquier cambio de migración; CI Auth/PostgREST, preview, evaluación real y migración alojada pendientes.

La habilitación prevista es solo `CONSULTATION_INTELLIGENCE_ENABLED=true` con proveedor determinista local. `CONSULTATION_MODEL_GATEWAY_ENABLED`, procesamiento IA remoto y todos los flags de envío de inteligencia permanecen apagados. Recuperación: apagar el flag de inteligencia y revertir el commit por PR; conservar tablas aditivas y datos, sin DROP ni purgas manuales. No cambiar el correo existente por inferencia.

Documentación de contrato: [camelRun OpenAPI](https://run.camelai.com/v1/openapi.json), [costos](https://run.camelai.com/docs/pricing.md), [Ollama chat](https://docs.ollama.com/api/chat).
