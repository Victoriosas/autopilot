# Auditoría de alineación y continuación técnica · 05/11/2026

Corte: 05/11/2026, America/Montevideo (consultas remotas 06/11 UTC). Base GitHub verificada por Git y API: `458146239f383a630d81737cf40602b9b966ae94`. Informe de estado, no autorización de publicación ni de gasto. Dirección vigente: [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md).

## Estados y evidencia

| Estado | Evidencia | Límite |
| --- | --- | --- |
| DEFINIDO | F0–F8, prioridad F1 → F2 → F3 → F4; Codex ejecutor principal por orden actual del propietario | OpenCode auxiliar; no crear integraciones ni procesos paralelos |
| PROBADO | F1 canario supervisado del 04/11, documentado y fusionado en #184; comprobaciones GET actuales correctas | No se repitió POST ni correo productivo en esta misión |
| FUSIONADO | #181–#185, #190–#193, verificadas contra main | #186–#189 y #194 todavía abiertas al corte |
| DESPLEGADO | Vercel production READY `dpl_EbKGETkZ9NX9GKBAHw9YLZ6wNKh8`, SHA `4581462`; dominio `/api/health` devuelve SHA completo, runtime vercel y checkout cerrado | `get_project.live=false` contradice la disponibilidad HTTP; no usar ese campo aislado para declarar caída |
| EJECUTADO | camelRun smoke real, run [42147359356](https://github.com/Victoriosas/autopilot/actions/runs/42147359356): 3/3 casos y 6/6 controles | Muestra de la misma familia de precio; `complete=false`, `full_evaluation_passed=false`, `gate_ok=false` |
| BLOQUEADO | Puerta completa F3 y circuito F4 con borrador de modelo evaluado | No activar respuestas a clientas ni consumir nuevas inferencias de pago por esta orden general |

## GitHub y PC

- `C:/autopilot`: rama `agent/ecc-selective-quality-20261025`, HEAD `2632694`; 0 commits exclusivos y 53 detrás de main; 0 archivos rastreados modificados y 255 sin seguimiento. No es una PC totalmente sincronizada.
- `main` local, en `integracion-local-20261029`, está en `8f1afe4`, cuatro commits detrás, sin modificaciones rastreadas. No se cambió esa rama.
- Se inspeccionaron los 26 worktrees existentes accesibles y el nuevo worktree de esta misión. Se detectaron cambios rastreados en `diseno` (9), `glm53-opencode-20261031` (16), `consultation-ai-circuit` (1) y `consultation-phase2` (10), además de archivos sin seguimiento en varios worktrees. Sus commits y archivos se conservaron sin integrar, limpiar ni guardar en stash. Una entrada temporal adicional figura prunable; no se podó.
- Trabajo propio aislado: `codex/alignment-audit-20261105`, `C:/autopilot-worktrees/alignment-audit-20261105`, creado desde el SHA remoto. `git fetch` actualizó referencias; no se hizo pull sobre árboles sucios. No se creó backup global ni se declara reconciliación completa: antes de integrar ramas antiguas sigue siendo necesario respaldar y revisar su contenido conforme a [SYNC_PC_GITHUB_SEGURO.md](SYNC_PC_GITHUB_SEGURO.md).

| PR recientes | Resultado y alcance |
| --- | --- |
| #181 | FUSIONADA: dirección, fases, auditoría y guía de sincronización |
| #182 | FUSIONADA: recuperación pública de consultas |
| #183–#184 | FUSIONADAS: recepción y cierre E2E supervisado |
| #185 | FUSIONADA: pestaña Fichas, avance y guardas de revisión |
| #186–#187 | ABIERTAS, mergeable y detrás de main: roles Codex/OpenCode y triaje histórico; no duplicar sus propuestas |
| #188 | ABIERTA, mergeable y detrás de main: portabilidad de captura en otro test F2; no arregla el fallo de laboratorio detectado aquí |
| #189 | ABIERTA/DRAFT, mergeable y detrás de main: carga provisional histórica; sus límites no sustituyen la aprobación posterior observada |
| #190 | FUSIONADA: avisos exactos de límites en evidencia aprobada |
| #191–#193 | FUSIONADAS: esquema estructurado, finalización y reparación acotada camelRun |
| #194 | ABIERTA, mergeable: registra smoke; se conserva independiente |

PR antiguas #122, #124, #125, #129 y #131 presentan conflictos; no fusionarlas en bloque. #90 y #111 siguen en borrador; #168/#169 son dependencias abiertas. No se cerraron ni alteraron PR ajenas. Los conteos ahead/behind expresan ascendencia Git, no equivalencia funcional de cambios fusionados por squash.

## F1, F2, F3 y F4

**F1 — PROBADO previamente y disponible en lectura hoy.** [Canario del 04/11](F1_RECEPCION_PRODUCTIVA_CONTROLADA_20261104.md): formulario, consentimiento, persistencia, replay idempotente, aprobación humana, Resend delivered y recepción Gmail para un buzón propio. Hoy home y `/consultanos` HTTP 200; config HTTP 200, `enabled=true`, `privacyVersion=consultation-v1`, `retentionDays=30`; administración anónima HTTP 401. Sin nuevo canario, auditoría visual móvil ni lectura de expedientes. La CI actual de main falla en un recorrido sintético de navegador, descrito abajo; no es evidencia de caída productiva.

**F2 — 17 descripciones aprobadas, alcance profesional limitado.** Consulta agregada al Supabase principal tomando solo la última versión por slug: 21 servicios (17 canónicos + cuatro históricos), 17 fichas últimas, 17 `approvedForAI`, 17 vigentes, 17 con responsable registrado y cero `priceApproved`. Se verificaron 41 migraciones y RLS activo en consultas y conocimiento privado. No se leyeron descripciones, importes ni identidades de responsables. Los 17 servicios conservan el inventario de [la hoja de revisión](F2_REVISION_VICTORIA_17_TRATAMIENTOS_20261104.md); sus afirmaciones iniciales de cero fichas son históricas y quedan superadas por esta lectura y la continuidad de #190. La aprobación de descripción no aprueba protocolos, tiempos, técnicas, tarifas ni publicación adicional. No se declara cerrada toda la puerta F2 ni se añaden aprobaciones.

**F3 — smoke EJECUTADO, evaluación completa BLOQUEADA.** Artefacto saneado `consultation-synthetic-evaluation/manual.json` del run 42147359356, SHA 4581462: EV-001/002/003 aprobados, los tres críticos y todos de `precio_sin_evidencia`; seis controles negativos aprobados, cero avisos. `cost_usd=0.0134` con semántica `reported_or_reserved_upper_bound`, reserva US$0,30; no es factura exacta. El workflow termina failure/código 1 porque la muestra no completa los 32 casos de desarrollo, no porque esos nueve controles/casos hayan fallado. Mantener ocho finales reservados y seis controles en la misma corrida completa. La corrida previa de desarrollo 42131213750 registró 1/32 y 6/6 controles; ese resultado antecede a #191–#193 y no acredita la corrección actual.

Inventario camelRun actual: siete agentes definidos, todos `loaded=false`, `toolsConnected=false`; tres QA Sonnet, tres laboratorio Gemma y un supervisor Sonnet. El evaluador usa su contrato por API y no prueba operación permanente de esos agentes. No se ejecutó un modelo en esta misión. Dry-run actual: 32 casos, 24 críticos, seis controles, reserva máxima US$2,04, evaluación completa false. No se abrieron casos finales para ajustar prompts.

**F4 — correo humano PROBADO; circuito de IA completo pendiente.** Se reutiliza la evidencia de F1 para entrega supervisada, sin atribuirle un modelo ni una recepción omnicanal. Faltan aprobación completa de F3 y trazabilidad de un borrador del modelo validado hasta revisión/entrega autorizada; WhatsApp entrante, agenda y autonomía continúan fuera de este cierre.

## Conexiones actuales

| Servicio | Lectura actual | Pendiente / riesgo |
| --- | --- | --- |
| Supabase | Principal `jfjzpwlrhzqbcrvqxhzf` ACTIVE_HEALTHY; 41 migraciones, RLS y conteos anteriores. Secundario `uunygxsjzavzmfqfijka` también healthy | Issue [#180](https://github.com/Victoriosas/autopilot/issues/180) abierto: Preview de PR #193 omitida y enlazada al secundario. No equivale a integración probada; no se tocaron ramas ni historia |
| Vercel | Production READY y health del dominio coinciden con main 4581462 | `live=false` aislado no concuerda con HTTP 200; no se alteró hosting |
| Cloudflare | Zona oficial activa, no pausada, nameservers emely/terin; respuestas públicas `server=cloudflare` | GET exitoso no prueba desafío inicial desde todas las redes |
| Resend | Dominio verificado, sending/receiving enabled, región sa-east-1; cero webhooks | Capacidades no prueban ingesta de correo. Sin webhook, no afirmar actualización automática de delivery; canario anterior es evidencia independiente |
| camelRun | Inventario de siete agentes accesible; artefacto y logs de ejecución reales en GitHub | Sin aprobación completa ni garantía de costo total cero; no activar clientes |

Issue [#175](https://github.com/Victoriosas/autopilot/issues/175) sigue abierto. RLS activo no sustituye una auditoría completa de permisos o seguridad; no se cambiaron grants ni protección de credenciales.

## Siguiente tarea segura ejecutada: recuperar el test de integración

Fase F1/F2. Hipótesis reproducida por la CI de main [42147309671](https://github.com/Victoriosas/autopilot/actions/runs/42147309671): después del POST sintético y replay, el test pulsa `Fichas privadas para Victoria`, que ahora está abierto por defecto; lo cierra y agota 30 segundos esperando `Cargar los 17 tratamientos`. El laboratorio también pasó a un desplegable independiente cerrado por defecto.

Cambio mínimo en `scripts/test-consultation-lab-browser.ts`: comprobar que el botón inicial está visible sin cerrar el editor y abrir explícitamente `Laboratorio de IA (solo simulación)` antes de simular. Se conservan todas las aserciones de persistencia, consentimiento, idempotencia, evidencia aprobada, aprobación humana, denegaciones y correos interceptados. Sin cambios a aplicación, prompts, corpus, workflow, DB ni guardas. No se aumenta el timeout ni se omite el recorrido.

Validación local: `npm run verify` aprobado, 412/412 pruebas sin fallos ni omitidas, TypeScript y builds Node/Vercel correctos; rutas/HTML, escáner de secretos y `git diff --check` aprobados. La comprobación de HTML se lanzó inicialmente antes de terminar el build y falló por artefacto todavía ausente; se repitió tras el build y aprobó. El navegador con Auth/PostgREST real requiere el runner aislado de CI: la PC no tiene Docker/Podman. Exigir `validate`, `postgres` y `beauty-stack` del SHA propuesto; un check omitido no basta. Rollback: revertir el cambio del script; documentación preserva la foto fechada.

## Prioridad siguiente y autorización necesaria

1. Terminar la CI aislada del test corregido y revisión humana de esta PR; sin auto-merge ni promoción manual.
2. Preparar desarrollo completo camelRun con 32 casos y seis controles, sin finales. Su ejecución externa requiere autorización específica vigente y evidencia de tarifas/límites: reserva técnica US$2,04 no es permiso de gasto.
3. Solo tras desarrollo y controles aprobados, medición completa de 40 casos con los ocho finales bajo las guardas existentes; después F4 supervisada. No adelantar F5–F8.

No se cambiaron automatizaciones, servicios, credenciales, DNS, migraciones alojadas, pagos, fichas, contenidos públicos ni mensajes. Coste de inferencia de esta misión: cero llamadas; no se afirma costo total cero de infraestructura/CI ni ingresos. No hay datos reales suficientes de sesiones, conversión o ventas.
