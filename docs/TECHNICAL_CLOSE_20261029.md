# Cierre técnico observado · 29/10/2026 · America/Montevideo

Estado: **cierre parcial comprobado; operación alojada bloqueada por hosting**.

## Integración y cambio concreto

- Main sigue en `27b95a5c5ff4fd845ac7b318e0c1a55b25aaa44b`.
- PR [148](https://github.com/Victoriosas/autopilot/pull/148), candidato inicial `71ebf8d842248b6df2bf7d9aa5c54b7f1c0aa4ef`, incorpora main y los seis SHA originales de #141/#142/#143/#144/#145/#147. Ascendencia comprobada; las siete PR no tienen conversaciones de revisión. No cerrar originales hasta incorporar y comprobar su contenido en main.
- Rama aislada `codex/technical-close-20261029`; código `537d583462c9c5993c587bc132bc4e46431ad83e`. El checkout original y los worktrees ajenos se conservan. Integración propuesta sobre la rama de #148, sin activar su publicación productiva.
- La bandeja usaba cualquier mensaje informativo para deshabilitar «Aprobar y enviar». Consultar un historial vacío impedía aprobar. Ahora decide por el historial confirmado; `sending`, resultados inciertos, errores y estados desconocidos bloquean otro intento. Actualizar limpia borradores/estados anteriores. Un HTTP 200 con estado inválido tampoco se interpreta como éxito.
- La carpeta atribuía IA a cualquier outbox `sent`. Ahora muestra **Aceptadas por Resend** y aclara que entrega y recepción humana no están confirmadas. No modifica registros históricos ni el contrato de envío.
- Se agrega una regresión del adaptador Vercel real: health, query repetida/codificada, caché, controles comerciales, bandeja anónima y 404.

## Evidencia local

- `npm ci --no-audit --no-fund`; Node 24.15.0, lockfile de #148.
- `npm run verify` del código final: **378/378**, cero fallos/omitidas, TypeScript y builds servidor/Vercel aprobados. Una segunda ejecución se justificó por el mensaje visible de historial desconocido añadido después de la primera; sin nuevas repeticiones por documentación.
- `node scripts/check-route-html.mjs`, `node scripts/secret-scan.mjs` y diffcheck aprobados.
- Worker, informe y health: `node --test scripts/agent-daily-report.test.mjs scripts/agent-health-queue.test.mjs scripts/infrastructure-health.test.mjs`: **17/17**.
- Evaluador `--dry-run --split all --confirm-final`: 40 casos congelados, 29 críticos, seis controles, cobertura completa, `full_evaluation_passed=false`. El máximo teórico US$2.52 no es autorización de gasto; **no hubo inferencia de pago**.
- Playwright CLI con componente real y API sintética: consultar historial vacío conserva aprobación; cancelar no envía; aceptación simulada se clasifica correctamente; duplicado, historial inaccesible y falso éxito HTTP200 bloqueados; WhatsApp informa integración pendiente. Capturas 390/1440 px en `output/playwright/technical-close-{mobile,desktop}.png`. Sin sesión administrativa alojada ni destinatarios reales. No es auditoría WCAG completa.
- Evidencia local detallada en `.audit/verify-final.log`, `browser-qa-final.log`, `health-regression.log` y `native-health.log`; harness sintético `.audit/inbox-qa.js` y fixture asociado. No contienen datos de clientas; no se suben logs/fixtures temporales indiscriminadamente.

## Hosting y DEP0169

- Dominio oficial `/api/health` y preview autorizado `autopilot-7dy57b3pw-autopilot12.vercel.app/api/health`: **HTTP402, DEPLOYMENT_DISABLED**, sin JSON de aplicación.
- Vercel registra producción `dpl_HiAcPg5a1CAsH47K7DpEkLujN76H`, main `27b95a5`, build READY. El estado READY no acredita disponibilidad HTTP. SSO/protecciones conservadas.
- [Monitor público](https://github.com/Victoriosas/autopilot/actions/runs/40969226633) y [worker](https://github.com/Victoriosas/autopilot/actions/runs/40968936971) fallidos. Incidente [149](https://github.com/Victoriosas/autopilot/issues/149).
- No se comprobó qué condición de cuenta/límite causa el bloqueo. La [documentación oficial](https://vercel.com/docs/errors/deployment_disabled) indica revisar uso/estado/notificaciones. La búsqueda acotada de avisos Vercel en el correo conectado no devolvió resultados. No se cambió plan, gasto, dominio, DNS, credenciales o protección ni se intentó promover un preview.
- [146](https://github.com/Victoriosas/autopilot/issues/146): Node24.15 fuente y bundle CJS nativo con `--trace-deprecation` responden health200, checkout cerrado, sin DEP0169; bandeja anónima401 y ruta inexistente404. No se atribuyó causa a Express/parseurl ni se silenciaron warnings. La consulta de logs Vercel agotó su tiempo. Falta traza alojada después de recuperar hosting; issue abierta.

## Consultas y Supabase alojado

Proyecto confirmado `victoriosa-autopilot`, `jfjzpwlrhzqbcrvqxhzf`, ACTIVE_HEALTHY. Lecturas exclusivamente de metadatos, permisos y agregados; sin mensajes, identidades, destinatarios, claves ni SQL de mutación.

- Historia alojada incluye consultas privadas, outbox, estado administrativo, lectura, consentimiento IA, inteligencia, presupuestos/refresh y cola de seis agentes. No `db push`, reset ni migración nueva.
- Seis tablas de consultas/inteligencia con RLS y sin SELECT de anon/authenticated. `agent_tasks`/`agent_audit_events` tienen grants pero RLS sin políticas: lectura real como anon devolvió cero filas en ambas; no confundir grant con exposición efectiva.
- Agregados al observar: 10 consultas, cero vencidas, 10 outbox `sent` y un run de inteligencia. Son registros de aplicación; no prueban entrega, recepción humana, aprobación semántica ni ventas.
- Un único cron de retención, horario, activo; **145 ejecuciones succeeded**, última 29/10 23:00 UTC. Cero vencidas observadas. No se duplicó el cron ni se ejecutó purga manual.
- La suite actual cubre validación, consentimiento, límites/abuso, idempotencia, preferencias de canal, privacidad, permisos, lectura y circuito supervisado. PostgreSQL/Auth/RLS aislados se acreditan por la CI del candidato correspondiente; no por las pruebas Node o por Supabase Preview omitido.
- Edición de texto y aprobación exacta existen en `ConsultationIntelligencePanel` y su router: revisión registrada no equivale a envío. Autenticación/RBAC se conservan. Recorrido con sesión administrativa alojada **no verificado** por hosting y ausencia de una sesión autorizada disponible.

## IA, correo, WhatsApp y catálogo

- camelRun conservado: cuatro agentes existentes listados (tres QA y supervisor), todos `loaded=false`, `toolsConnected=false`. Esto no demuestra ejecución ni capacidad gratuita. No se invocó ningún modelo remoto ni se consumieron créditos.
- Ollama0.40.11: Gemma270m falló en carga CUDA (`unsupported toolchain`). Alternativa CPU temporal, sin nube ni descargas: chat JSON correcto, tres etapas, guardián **blocked**, `no_send`, códigos `MODEL_DISAGREEMENT_REVIEW`/`MODEL_REVIEW_NOT_APPROVED`. Qwen4b excedió el tiempo del chat mientras cargaba. Se detuvo únicamente el servidor creado en esta sesión; sin listener11434 al cerrar.
- No se cambiaron prompts/casos/hash/umbrales ni se abrieron casos finales para ajuste. No hay modelo gratuito capaz comprobado ni evaluación real completa; IA permanece supervisada y sin autoenvío. [Selección CPU oficial](https://docs.ollama.com/gpu#gpu-selection).
- Resend confirma dominio `victoriosas.online` verificado, envío/recepción habilitados y tracking apagado. No se extrajeron correos de clientas ni se enviaron mensajes nuevos. Outbox aceptado, evento de entrega y confirmación humana son evidencias distintas; las dos últimas siguen sin comprobar en este cierre.
- Web/WhatsApp separados; pestaña WhatsApp explicita ausencia de sincronización. Hay enlace/contacto manual y copia de borrador, sin integración entrante autorizada disponible. No usar sesiones extraídas para sustituirla.
- Catálogo actual de 17 servicios conservado, Victoria visible, sin mesoterapia reincorporada ni tarifas. Detalles contemplan punta de diamante, radiofrecuencia y electroporación según evaluación; no se inventó una nueva prestación por equipamiento. No cambios de recursos aprobados, checkout, precios, artículos o campañas.
- #122 sigue en borrador, pendiente validación comercial de Victoria; #124/#126 son ampliación/reparación no publicadas. No se activaron ni duplicaron.

## Los seis agentes, por evidencia

| Agente | Disparador/configuración | Ejecución y persistencia observada | Estado |
|---|---|---|---|
| director | Enqueue/poll del control plane | Sin tareas asignadas alojadas; pruebas de cola | DEFINIDO/PROBADO; operación no verificada |
| software | PR/issue/tarea explícita; intervención supervisada | CI/PR fuera de la cola; cero tareas alojadas del rol | DEFINIDO/PROBADO; sin worker autónomo acreditado |
| infrastructure | GitHub cada6h → OIDC → Edge → cola existente | 9 completadas con evidencia; 15 claims/6 failures auditados; 2 bloqueadas tras3 intentos y4 queued; última finalización27/10 22:24UTC | EJECUTADO históricamente; BLOQUEADO actualmente por health |
| consultations | Entrada autorizada y revisión humana | Persistencia de consultas separada; cero tareas asignadas del rol | Supervisado; IA no aprobada; web inaccesible |
| followup | Revisión autorizada de estado | Propuestas sin envío; cero tareas alojadas del rol | DEFINIDO/PROBADO; ejecución no verificada |
| reports | GitHub diario22UTC, OIDC/agregados | [Workflow observado SUCCESS](https://github.com/Victoriosas/autopilot/actions/runs/40800670457); cero tareas persistentes asignadas al rol reports | Workflow EJECUTADO; no acreditar worker persistente general |

La cola y el worker de infraestructura conservan claim transaccional, fencing/lease, idempotencia por slot, máximo3 intentos y bloqueo final. Pruebas aisladas no convierten los otros cinco roles en agentes autónomos. Perfiles ECC/OpenCode y agentes camelRun son componentes diferentes.

## Programación, recuperación y pendientes

- GitHub: health público `25 */6 * * *`; worker persistente `23 */6 * * *`; informe `0 22 * * *`. Los dos health tienen contratos distintos (rutas/controles frente a tarea persistente); se conservaron. Ejecución remota independiente de la PC, best effort, sin promesa de puntualidad.
- Codex local: automatización existente `victoriosa-autopilot-6h`, ACTIVE/cada6h. Depende del runtime/equipo local; no equivale a servicio24/7. No se creó otra automatización.
- Recuperación del cambio: revertir el commit de bandeja mediante PR; no toca SQL ni configuración productiva. Recuperación del hosting requiere revisar condición de cuenta/uso en Vercel, sin inferir que haya que comprar un plan.
- Siguiente acción externa indispensable: propietario recupera hosting dentro de sus condiciones autorizadas; después comprobar SHA exacto, health, formulario, autenticación y monitores. IA exige modelo gratuito capaz demostrado/evaluación completa; WhatsApp exige integración entrante autorizada; tarifas exigen validación de Victoria. No habilitar estas capacidades por inferencia.
- Main/publicación siguen fuera de este cierre hasta cumplir la autorización específica y verificación alojada. No auto-merge, despliegue manual, promoción de preview, gastos, nuevos envíos, SQL remoto ni datos personales.

CI y enlace de la integración final se registran en la PR; no atribuirle checks de un SHA anterior.
