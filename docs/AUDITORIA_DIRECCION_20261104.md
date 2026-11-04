# Auditoría técnica y de dirección | 03–04 noviembre 2026
**Corte inicial**: 2026-11-04, America/Montevideo. Inventario remoto de metadatos y repositorio; no se ejecutaron consultas productivas de prueba, mensajes, modelos, pagos, cambios de DNS ni cambios SQL remotos durante esta auditoría.

## Evidencia consolidada
| Superficie | Observación y evidencia | Límite |
|---|---|---|
| GitHub | `main=aef2ab73`, PR #174, #176, #177, #178 y #179 fusionadas durante el 04/11; #179 reconcilia 41 migraciones y separa propuestas legacy | Historias de PR no sustituyen prueba real de entrega |
| Vercel | Proyecto `autopilot`, team `autopilot12`, despliegue productivo `dpl_BGcHwAdiceNymZxfPk4DyrW6PKDh` READY con SHA `aef2ab73` | Salud del despliegue no prueba que /consultanos funcione en navegador con Cloudflare |
| Supabase principal | `jfjzpwlrhzqbcrvqxhzf` ACTIVE_HEALTHY, 41 migraciones, 17 `beauty_services`, 14 `consultation_requests`, 14 replies `sent`, 0 knowledge privado, 29 tareas (13 queued, 6 blocked, 1 failed, 9 completed) | Conteos sin expedientes; 14 sent no prueba conversación IA autónoma |
| Supabase alterno | `uunygxsjzavzmfqfijka` ACTIVE_HEALTHY. Issue #180 identifica Supabase Preview apuntando a proyecto histórico de 3 migraciones | No se tocó la integración, ni se confundió con base principal |
| camelRun | Siete agentes definidos: 3 QA de modelo de pago, 3 laboratorio Gemma, un supervisor. `loaded=false`, `toolsConnected=false` al revisar | No habilitados ni conectados a un runtime permanente; tarifa total gratuita no acreditada |
| Resend | Dominio victoriosas.online verificado, sending y receiving enabled. Cero webhooks configurados en la cuenta vista | Esto NO demuestra recepción entrante a la bandeja ni ruta completa de entrega/respuesta |
| Cloudflare | Zona victoriosas.online activa, nombre de servidores Cloudflare `emely.ns.cloudflare.com`, `terin.ns.cloudflare.com` | Verificar reglas de desafío antes de cambiar seguridad o DNS |
| PC | Desktop Commander: `micahael-PC` offline durante la auditoría | No se conoce estado local de `C:\autopilot`, ramas ni archivos no versionados; no afirmar sincronizada |

## Cambios revisados
- #174: fallback sintético sin hechos privados, no es un agente real.
- #176: `credentials: same-origin` para mantener cookies de desafío en GET y POST; no garantiza superar desafío Cloudflare en un cliente sin verificación.
- #177: implementación de limpieza privilegiada aislada; se revisan grants/RLS de conocimiento y RPC.
- #178: selector accesible en desktop/touch y vía de respuesta email de aprobación explícita, retirada ruta de acuse automático; CI sintética con Auth/PostgREST y Resend interceptado, no email real.
- #179: carpeta de 41 SQL históricos reconciliada, replay desechable, propuestas comerciales no aplicadas aisladas. Check Supabase Preview externa sigue pendiente/fallido por proyecto equivocado (#180).
- Seguridad: asesor Supabase registra avisos de RLS sin políticas, muchas tablas de acceso server-only por diseño, y issue #175 de revisión de permisos/protección de credenciales. No habilitar políticas permisivas para silenciar avisos.
- Rendimiento: asesor Supabase encuentra FK `private.consultation_service_knowledge.reviewed_by` sin índice de cobertura. Prioridad menor mientras tabla esté vacía.
- Vercel error agregador encuentra advertencia Node `DEP0169 url.parse()` en /api/server; diagnosticar dependencia, no tratar como caída confirmada.

## Riesgos priorizados
1. **P0** disponibilidad real de /consultanos frente a desafío Cloudflare, conexión de formulario, endpoint, Auth y persistencia.
2. **P0** cerrar deriva de verificación de CI Supabase Preview: proyecto secundario equivocado, sin tocar datos ni ramas pagas.
3. **P1** fichas privadas validadas por Victoria para 17 tratamientos, permiso de edición, versión y hechos permitidos; hoy 0 filas.
4. **P1** recepción, lectura admin y respuesta por Resend/Gmail con trazabilidad; nunca duplicar ni automatizar respuestas sensibles.
5. **P1** agente lab de costo cero real y 40+6 casos; comprobar seguridad/modelo/herramientas en sintético antes de clientes.
6. **P2** reducción de cola seis agentes y controles de ejecución durable, métricas; después WhatsApp/Meta/redes.

## Comprobaciones pendientes
- PC offline impide examinar trabajo Codex no publicado y reconciliar worktrees. Usar `docs/SYNC_PC_GITHUB_SEGURO.md` al volver a conectarse.
- Navegador externo no logró obtener victorias.online; no hay verificación end-to-end posterior al deployment.
- No se inspeccionaron cuerpos de correos o PII, no se hicieron POST ni envío de prueba.
- No se ejecutó CI nueva en esta auditoría; los resultados registrados corresponden a las PR existentes.

## Fuentes internas revisadas
GitHub: PR [#174](https://github.com/Victoriosas/autopilot/pull/174), [#176](https://github.com/Victoriosas/autopilot/pull/176), [#177](https://github.com/Victoriosas/autopilot/pull/177), [#178](https://github.com/Victoriosas/autopilot/pull/178), [#179](https://github.com/Victoriosas/autopilot/pull/179), [issue #180](https://github.com/Victoriosas/autopilot/issues/180), [issue #175](https://github.com/Victoriosas/autopilot/issues/175), runbooks docs/CONSULTATION_STABILIZATION_20261104.md y docs/SUPABASE_HISTORY_RECONCILIATION_20261104.md.
