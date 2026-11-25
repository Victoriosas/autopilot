# Plan maestro lineal de Victoriosas Autopilot

Referencia: 14/11/2026, America/Montevideo. Este es el plan técnico canónico para nuevas órdenes. La visión, las fases de producto F0–F8 y sus autorizaciones siguen en [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md). Los P0–P6 de este plan son etapas técnicas de una sola cadena; no autorizan saltar F1→F2→F3→F4 ni abrir un programa paralelo.

**Orden vigente 22/11: `ORD-AUTONOMOUS-ENGINE-01`, F0 / P2 parcial.** La primera dependencia segura es reconciliar el estado real del worker/ledger y cerrar fallas de autorización/lease en una propuesta aislada. Esta orden no autoriza SQL alojado, instalar extensiones, crear cron, desplegar, activar P3/F5 ni declarar una ejecución de `director`. El circuito real solo podrá prepararse o ejecutarse cuando los criterios de esta guía, los permisos externos y las puertas de producto lo permitan. Estado operativo: [CODEX_CONTINUATION.json](CODEX_CONTINUATION.json), evidencia: [auditoría del motor](AUTONOMOUS_ENGINE_AUDIT_20261122.md).

## Orden vigente del propietario · motor autónomo limitado · 22/11/2026

La orden única vigente es `ORD-AUTONOMOUS-ENGINE-01`. El objetivo inmediato es reconciliar el sistema Supabase real con el repo y preparar correcciones mínimas de lease/ACL en migración versionada y PostgreSQL aislado. La auditoría actual no encuentra un worker `director`, una tarea `director`, `six_agent_claim_mission` alojado, un cron de agentes ni evidencia de ejecución independiente.

Esta orden no es permiso para modificar Supabase alojado ni desplegar. El plan Free, la extensión `pg_net` ausente, la autenticación del disparador y el límite de exposición de secretos de `pg_net` se revisan antes de diseñar el cron. La primera función no podrá enviar, comprar, cambiar registros de clientas, aplicar código ni desplegar. Un mensaje `ready` o una métrica agregada no puede presentarse como ejecución. El circuito requerirá inserción idempotente autorizada, claim limitado por misión/rol, ejecución read-only, verificador independiente, finalización con evidencia y audit event. Solo una ejecución alojada verificada por otro proceso cumple el criterio final.

**P2 anterior:** la cancelación nativa y su recibo permanecen `INDETERMINADO/PRESERVAR`; no se reejecuta ni se modifica ese worktree. Los carriles A/B/C/D de `ORD-THREE-DEMONSTRATIONS-20261121` quedan estacionados por esta orden del propietario, con PRs, ramas y worktrees preservados; no se borran ni se retoman implícitamente. PR #269 además conserva un hallazgo `no_send` estructural abierto y no debe fusionarse mientras siga vigente. Esta sustitución de prioridad no declara cerradas esas tareas ni las puertas F0–F4.

## Autoridad y avance

Propietario fija políticas y permisos; Victoria valida hechos profesionales; Autopilot propone y coordina dentro de ellos; Codex ejecuta; el verificador comprueba; SQL ledger conserva claims/efectos y el JSON conserva una orden técnica. No crear otra cola, ledger, scheduler, supervisor equivalente o infraestructura para eludir un bloqueo.

Solo avanzar una fase mediante evidencia de sus criterios y actualización revisada del mismo JSON. Un checkbox, una definición de agente, CI verde o una misión sintética no son cierre operativo. Diferenciar por subsistema DEFINIDO / IMPLEMENTADO / PROBADO / FUSIONADO / DESPLEGADO / EJECUTADO / BLOQUEADO. Conservar SHA, entorno, fecha, alcance y límites de cada prueba.

Una eliminación opcional no bloquea el producto por sí misma: puede cerrarse como CONSERVAR con razón, propietario y recuperación. Una duplicación con riesgo de escritura o autorización sí bloquea hasta resolverla. No forzar una reducción de carpetas ni usar un plan nuevo como prueba de progreso.

## P0 - Reconciliacion y limpieza - CERRADA CON LIMITES EN MAIN

**Objetivo verificable:** una base de verdad trazable, recursos preservados, una fuente de estado y cero escritores conflictivos en el ámbito del siguiente cambio.

**Dependencias:** acceso de lectura GitHub/PC/cloud; inventario fechado; autorizaciones específicas separadas para borrar o modificar servicios. La auditoría no concede ninguna.

**Reutilizar:** AGENTS, PROJECT_DIRECTION, CODEX_CONTINUATION.json, auditoría/manifiesto, CI/main `a4ca9dd31afa6f576d0bd5e52bc83ffb72e9272c`, PR existentes y backups existentes sin asumir restaurabilidad.

**Evidencia nueva ya obtenida:** las 24 fuentes locales de `cloud-ledger-adapter-20261112` y `autonomy-continuity-20261112` se compararon: ocho idénticas a main tras normalizar CRLF, trece idénticas a versiones anteriores de main y tres con una línea final vacía adicional. Ninguna exige reintegrar código. [Reconciliación](audits/evidence-20261114/local-cloud-reconciliation.json); conservar ambos árboles sin reset/clean.

**Orden local ya ejecutada:** `alignment-audit-20261105` y `diseno` tienen procedencia/custodia de proyecto identificada, búsqueda de consumidores y preservación cifrada con recuperación en memoria de745/405 archivos verificada por un proceso nuevo. Historias Git completas cifradas y validación strict dry-run; ningún original modificado. Ignorados, autoría humana y recuperación offsite no certificados: ambos CONSERVAR, sin propuesta de eliminación. [Veredicto P0](audits/P0_RECONCILIATION_REVIEW_20261114.md).

**Disposición integrada de los gates P0:** la minimización quedó integrada por #236. El riesgo residual de metadatos en commits históricos queda registrado con conservación de historia y recursos; no se afirma purga ni ausencia de secretos en todo el historial. El heartbeat existente fue alineado y releído en la transición previa, sin que eso demuestre una ejecución programada; esta corrección no lo modifica. Los cierres externos de17 PR se registraron por decisión del propietario: conservar ramas/heads disponibles, no reabrir PR ni recrear la rama remota ausente por inferencia. Ignorados y recuperación offsite no certificados mantienen los recursos en CONSERVAR, sin impedir el cierre técnico limitado de P0 ya integrado. No repetir reconciliaciones sin cambio de evidencia ni abrir otro supervisor.

**Retiradas futuras, fuera de esta orden:** mantener como CONSERVAR los recursos de propietario/consumidor incierto. Antes de una eliminación expresamente autorizada, clasificar también ignorados y verificar una recuperación acorde al fallo que se pretende tolerar; la prueba DPAPI en esta máquina no certifica recuperación ante pérdida de perfil/equipo. No borrar exportaciones sin Git, refs, caches compartidas o worktrees por falta de uso observado.

**Pruebas obligatorias:** status y SHA por checkout; diff de trabajo indexado/no indexado y hashes selectivos sin secretos; comparación funcional y de patches, no solo ascendencia; relectura independiente del JSON y resolución de sus referencias; enlaces/JSON/diffcheck/secret scan para esta consolidación. Si hay cambio de aplicación posterior, verify y validate/postgres del SHA exacto. No repetir pruebas del código intacto sin motivo.

**Riesgos:** escritores sin cwd conocido; estados cambiantes; backups con secretos; ramas squash sin ascendencia; borrar fixtures/evidencia exclusiva; confundir repo marketplace con autopilot.

**Aceptación:** recursos conocidos conservados/clasificados y desconocidos explícitamente retenidos; tareas activas y límites registrados; propuesta agrupada de eliminación recuperable, o decisión de conservar; ningún ámbito compartido modificado; una sola orden en JSON; esta PR documental revisada con CI exacta; siguiente cambio asignado al componente existente.

**Rollback:** revertir solo esta propuesta documental por PR; conservar árbol ajeno, refs y bases cloud. No limpiar metadatos prunable por iniciativa propia.

**Evidencia de cierre:** #235 y #236 integradas, manifiesto minimizado, fuentes preservadas y recuperación en memoria documentada; #237 integró la transición técnica. **P0 CERRADA CON LÍMITES en main tras #237**, con los recursos de recuperación incompleta retenidos. #238 integra la observación runtime/CLI en main 4ceb541; P1 sigue parcial. Este cierre no certifica recuperación offsite, recepción del heartbeat ni culminación de la fase de producto F0.

## P1 - Consolidacion del nucleo Autopilot - CERRADA CON LIMITES

**Objetivo:** una decisión del supervisor se traduce en una observación y propuesta coherentes con el runtime y el ledger existentes, sin otorgar permisos implícitos.

**Dependencias satisfechas en el ambito P1:** P0 limitada y #237–#247 integradas; main verificado `823c2fef706dbe4518bd322afdf6d666c8a1caf8`. Conservar refs históricas sin duplicar implementaciones. Acta248 integrada con autorizacion explicita; main8633b36 validate/postgres/CodeQL aprobados.

**Reutilizar:** permanentSupervisor de #234; missionRuntime, executorAdapter, missionPlanner, sixAgentPersistence, LocalMissionStore y CloudMissionStore, sin otorgar alcance remoto al contrato local. Retener DevelopmentLedger únicamente para su laboratorio acotado.

**Resultado medido:** observación/propuesta no otorga permisos; autorización host por claim y efecto, política durable/revocación en la misma fila SQL, lease/fencing y atestación independiente integrados. #246 completa transporte SET LOCAL/identidad; #247 prueba recuperación terminal protegida en proceso Node nuevo: grant fresco tras lease vencida, intento2/checkpoint5, token antiguo rechazado y ningún replay. Artefacto adulterado bloquea finalización y preserva checkpoint/auditoría.

**Veredicto:** `P1_CLOSED_WITH_BOUNDARIES` técnico, integrado por248 en el mismo checkpoint; no quedan gates técnicos locales P1 pendientes. Main validate/postgres/CodeQL aprobados por SHA exacto; validate574 pass/1 skip exclusivo Windows y operador SQL1/1 sin omisiones. [Acta, matriz y enlaces CI](P1_EXIT_REVIEW_20261117.md). P2 sigue inactiva. No certifica identidad remota, atomicidad filesystem/SQL, recuperación general incierta, Windows/cross-host, despliegue alojado o recepción del heartbeat; cloud conserva su fallo cerrado. No cierra fases F0–F8.

**Pruebas:** entradas desconocidas/booleanos falsificados, estado blocked/retry_wait/ready_to_complete, lease activa/expirada, versión antigua, prioridades y fase no autorizada, misión terminal, evidencia ausente; casos de componente y SQL aislado. Ningún estado desconocido puede producir dispatch. Verify y CI por SHA.

**Riesgos:** divergencia entre vocabularios de estados; aprobación autodeclarada; starvation por prioridad; doble claim; ampliar el objetivo sintético a comandos arbitrarios.

**Aceptación:** componente único montado en el ámbito revisado, contrato negativo completo, claim SQL sigue siendo autoridad y no hay segundo scheduler/ledger. IMPLEMENTADO y PROBADO no equivalen a activación remota.

**Rollback:** revertir adaptador/PR; dejar observación sin efectos y cola conservada.

**Cierre:** circuito supervisor→runtime→ledger probado en main823c2fe, con limites anteriores; registro integrado mediante248 con autorizacion del propietario. Decidir activacion P2 del mismo plan, sin iniciarla por esta acta.

## P2 · Recuperación y verificación independiente — ACTIVA, PARCIAL

**Activación del primer incremento (17/11):** el propietario continúa después del contrato preparado e integrado por249. Única orden activa `ORD-P2-RECOVERY-VERIFICATION-20261117`, productoF0 sin cambio. [Evidencia del incremento](P2_PROTECTED_EFFECT_RECOVERY_20261117.md): scope fijo reconcile_effect CP2/plan1, permiso durable nuevo, oráculo post-claim independiente y reconciliación sin escribir. Nativo4/4 y verify579/579 aprobados; candidata requiere CI exacta/revisión/integración. La ruta terminal P1 conserva sus restricciones. No cierre P2, P3, SQL alojado ni scheduler.

**Siguiente dependencia P2:** después de verificar/integrar este incremento, medir cancelación durante reconciliación con cierre de descendientes propios, rechazo de escritura tardía y preservación del checkpoint/auditoría. Mantener el [contrato completo](P2_RECOVERY_PREPARATION_RUNTIME_AUDIT_20261117.md) como matriz pendiente; no reconstruir lo integrado ni ampliar timeouts por rutina.

**Objetivo:** interrupción y reanudación conservan checkpoint, rechazan escritor obsoleto y no repiten efectos aceptados.

**Dependencias:** P1 y exclusión del ámbito; almacenamiento del efecto definido, presupuesto y cancelación. No inferir recuperación Windows de pruebas Linux.

**Reutilizar:** tests mission-runner/operator/planner/cloud-ledger en `tests/`, fixtures TLS, managedProcesses, fencing SQL, VerificationEngine/oráculos externos, cadena ORD-204G #213→#220→#222/#223 solo tras reconciliar sus conflictos.

**Cambios mínimos:** seleccionar un efecto sintético reproducible y matar el proceso en cada frontera crítica; reconciliar artefacto existente y respuesta incierta antes de repetir. Acotar la integración Windows al mismo runtime, no convertir gestores de ventanas o viki en otro director.

**Pruebas:** antes/después de claim, efecto aplicado sin checkpoint, checkpoint sin cierre, lease expirada, token viejo, reinicio del host, deadline, descendientes, cancelación y resultados falsificados; oráculo fuera del área escribible del executor. Regresión SQL real desechable, verify y CI.

**Riesgos:** exactly-once supuesto por contar ejecuciones, pérdida de artefacto efímero, confundir atomicidad SQL con atomicidad de filesystem, repetir acción de resultado desconocido.

**Aceptación:** recuperación observable sin duplicar efecto; token antiguo denegado; fallo de verificación bloquea cierre; evidencia ajena al candidato y presupuestos respetados. Windows y cloud se acreditan separadamente.

**Rollback:** detener solo procesos propios identificados; mantener ledger/checkpoint/evidencias, no readmitir misión terminal ni resetear intentos.

**Cierre:** IDs/run/SHA, cronología de interrupción y hashes del efecto antes/después, negativos y limitaciones.

## P3 · Continuidad cloud — DEFINIDA

**Objetivo:** la misma cadena puede reanudarse en hosts cloud con estado y efectos recuperables bajo controles vigentes.

**Dependencias:** P2; autorización específica para una prueba remota concreta, revisión del SHA/environment y coste total. El permiso excepcional de 43657434746 caducó con ese run.

**Reutilizar:** PLAN Cloud existente, CloudMissionStore y ledger aislado `juyowvmtluxfetgkckjd`; no tocar principal `jfjzpwlrhzqbcrvqxhzf`. P0C ya resolvió transporte y hosted-status; no repetir bootstrap/rotación/admisión.

**Cambios mínimos:** resolver persistencia/recuperación del efecto entre runners con recursos existentes y un contrato explícito. Mantener handoff automático cerrado hasta demostrarlo. Actualizar el diagnóstico fijo `cloud_ledger_adapter_not_configured` en una propuesta revisada cuando corresponda, sin desactivar el bloqueo para pintar CI verde. Separar diagnóstico de activación.

**Pruebas:** dos hosts reales autorizados con interrupción y mismo binding, efectos disponibles y reconciliados, identidad/CA/verify-full/backendTLS, runner mínimo, sin membresías ni admisión, fencing/checkpoint y terminal sin nuevas escrituras. Ambiente protegido y SHA revisado exacto. Si no hay permiso, preparar ensayo y registrar BLOQUEADO; no despachar.

**Riesgos:** modelo/API no gratuitos, artefactos efímeros, secret en código de PR, workflow_run privilegiado, bypass humano reutilizado, principal confundido con ledger.

**Aceptación:** ejecución originada y recuperada entre hosts demostrada; métricas/run/errores y mecanismo de activación documentados; no basta hosted-status ni un workflow configurado. Continuidad desatendida necesita autorización propia y evidencia de runtime; no prometer24/7.

**Rollback:** retirar autorización de dispatch/SHA bajo permiso; parar trabajo propio, preservar ledger, no rebajar TLS/RLS ni borrar datos.

**Cierre:** run IDs, SHA, controles, coste observado y recuperación del efecto. Estado actual: transporte PROBADO históricamente; continuidad de efectos NO COMPROBADA.

## P4 · Autodesarrollo mediante Codex — DEFINIDA

**Objetivo:** Autopilot deriva una tarea acotada, Codex prepara diff aislado y un verificador independiente decide aceptación.

**Dependencias:** P3; contrato de ejecutor Codex autenticado/autorizado y coste/cuota comprobados; política de archivos/comandos y parada.

**Reutilizar:** ExecutorAdapter, developmentAccess, managedProcesses, readinessDevelopment, selfDevelopment, CLI/skill coordinadora y flujo PR existente. Los laboratorios actuales no son integración Codex general.

**Cambios mínimos:** añadir capacidad al adaptador existente con ruta de trabajo, permiso, objetivo, presupuesto, timeout y salida estructurada fijados por host; candidato sin acceso a secretos, autorización ni oráculo. Una PR por misión, reanudación por ID y diff existente. No arrancar OpenCode como director ni duplicar plataforma.

**Pruebas:** tarea sintética/real reversible revisada; diff fuera de allowlist rechazado; dependencia o test falsificado; cuota/deadline; pérdida de proceso; PR ya creada; resultado incierto; ausencia de permiso; regresiones de app/SQL según alcance y CI exacta. No ejecución de scripts arbitrarios de una rama con secretos.

**Riesgos:** prompt injection desde issue/documento; tests autocertificados; fuga de credenciales; coste no medido; dos escritores; merge o deploy implícito.

**Aceptación:** una tarea del mismo plan produce propuesta verificable con permisos mínimos, revisión y checkpoint recuperables; cero cambios ajenos y sin merge/envíos/deploy por autonomía genérica.

**Rollback:** cancelar ejecutor y conservar diff/PR en borrador; revertir solo la integración revisada, no el trabajo ajeno.

**Cierre:** objetivo, diff, IDs, resultado del verificador, pruebas, presupuesto/coste observado, PR y siguiente misión de la misma fase.

## P5 · Integración de capacidades Victoriosas — DEFINIDA

**Objetivo:** reutilizar el circuito visita→consentimiento→expediente→conocimiento→borrador→Guardián→revisión humana→respuesta auditada, según puertas F1–F4.

**Dependencias:** P4 y puertas del producto revalidadas. Hoy hay17 fichas vigentes con aprobación registrada, pero no evaluación semántica nueva ni tarifa aprobada. No deducir F3/F4 autónomas de esos metadatos.

**Reutilizar:** consultationRouter/Request/Supabase, outboxes, knowledge/versiones, groundedComposer/Guardian, materialStore y bandeja. Reconciliar #229 sobre #225–#227, no duplicar material ni autorizaciones. Resend existente y WhatsApp solo por canales/permisos vigentes.

**Cambios mínimos:** resolver el primer recorrido incompleto de F1, después F2, F3 y F4, usando la misma cadena de misión; integrar UI material si sigue siendo necesaria; alinear migraciones staged con historia alojada únicamente bajo autorización específica.

**Pruebas:** móvil/escritorio, auth401/403/503, origen/abuso/consentimiento/retención, RLS, idempotencia/replay, fuente vigente, Guárdian negativo, no_send y aprobación ligada al caso; 40 casos congelados+6 negativos para certificación de modelo; canario real y recepción humana solo con permiso concreto. No modificar corpus para aprobar.

**Riesgos:** PII a proveedor, diagnósticos/precios/agenda inventados, consentimiento confundido, aprobación de otro caso, doble envío, aceptación proveedor confundida con recepción.

**Aceptación:** evidencia end-to-end autorizada del circuito y puertas profesionales cumplidas, entrega/recepción diferenciadas y fallo seguro. Niveles N0–N4 conservan su aprobación; ecommerce y campañas no se reactivan.

**Rollback:** apagar únicamente la capacidad revisada según autorización, preservar expediente/outbox/auditoría y revisar entregas inciertas antes de reintentar.

**Cierre:** evidencia saneada por caso, SHA de app/DB/entorno, consentimiento/aprobación y límites de canal, sin datos personales en Git.

## P6 · Validación integral y preparación operativa — DEFINIDA

**Objetivo:** operación observable, recuperable y autorizada que cumpla las puertas de producto aplicables y reduzca carga humana de forma comprobable.

**Dependencias:** P5; política de operación, responsables, costes/límites, alertas, rollback y aprobación de publicación concreta. F6–F8 no se activan por este plan.

**Reutilizar:** CI, monitores existentes, ledger, métricas saneadas, checkpoints, bandeja y runbooks. No crear monitor o cadencia equivalente.

**Cambios mínimos:** cerrar huecos medidos de observabilidad, acceso y recuperación; definir responsables para incidentes y cancelación; preparar release revisable sin deploy manual ni auto-merge.

**Pruebas:** verify+SQL+seguridad por SHA, navegador y acceso real por entorno, recuperación/cancelación y no duplicación, coste/retención, escenarios adversos y recorrido humano controlado. Confirmar Vercel/main por SHA por separado. Smoke público no sustituye E2E ni disponibilidad universal.

**Riesgos:** declarar éxito por documentación/CI, monitor sin runtime, alertas sin consumidor, permisos excesivos, costes de infraestructura omitidos.

**Aceptación:** criterios de producto cumplidos y firmados cuando corresponda; runs y fallos observables; continuidad e incidentes ensayados; destinatario humano confirmado; límites y coste total conocidos. Despliegue solo específicamente autorizado.

**Rollback:** desactivar la capacidad nueva con ruta revisada, conservar datos y evidencias; nunca desproteger, resetear ledger ni perder historial.

**Cierre:** acta operativa con versiones, permisos, responsables, pruebas, riesgos residuales, coste y decisión humana. Solo entonces evaluar el siguiente objetivo dentro de PROJECT_DIRECTION.

## Historia: decisión de transición P0 a P1 (propuesta del 14/11/2026 UY; integrada por #237)

PR #236 integrada en main ce1027e5. Los recursos con recuperacion incompleta permanecen CONSERVAR; evidencia DPAPI CurrentUser verificada en memoria pero no offsite ni archivos ignorados. Metadatos de auditoria minimizados en el arbol vigente, versiones historicas accesibles; no se confirmo fuga de credenciales en revision acotada, no se purga historia ni se elimina respaldo. El heartbeat de Codex victoriosa-autopilot-6h mantiene identidad, estado ACTIVE, intervalo de seis horas y destino; solo el prompt local fue sustituido, verificado mediante relectura y copia anterior cifrada; NO esta demostrado que un run programado haya recargado el prompt. Estos limites son riesgos conservados que no obligan a borrar recursos ni rehacer auditorias generales. No cierran las puertas de producto F0-F8.

Texto histórico de la propuesta, superado por las integraciones #237/#238; no es una orden pendiente. Unica prioridad entonces propuesta P1: recuperar de #234 el supervisor puro e introducir adaptacion explicita a estados verificables del runtime, evitando propose_resume ante datos arbitrarios, sin reivindicar integracion operativa SQL/cloud. La transicion P0 a P1 solo sera vigente en main cuando esta PR pase revision y CI y se fusione; no activar dispatch.

## Historia: observación runtime (propuesta del 15/11/2026; integrada por #238)

Texto histórico, integrado por #238 en main4ceb541; no volver a implementar. Main f9c6ce68 contenía el supervisor puro PR237. En esa propuesta, PersistentMissionOrchestrator ofrece inspeccion estrictamente read-only de una mision sintetica F0: valida ID, usa la funcion preservada decidePermanentObjectiveForLocalStore, binding del host y estado SQL de LocalMissionStore/CloudMissionStore. El comando existente mission:local supervise expone la decision sin cargar payload de usuarios, claim, dispatch, replay, checkpoint ni efecto. La fase F0 se fija en el host y no se lee del texto de la mision.

Pruebas focalizadas RED/GREEN cubren lectura unica, binding/ID negativos, failed/retry y completed sin auto-certificacion; se agrega asercion de SQL PostgreSQL aislado comparando status, attempts, checkpoint version y auditoria antes/despues de la inspeccion. Los tests SQL, verify y CI se reportan por SHA final en la PR. Esta observacion no constituye el consumidor operativo que autorice claim, ni certifica cierre P1, P2, nube o heartbeat periodico.

Siguiente unico trabajo P1 tras este incremento: contrato de autorizacion y verificacion independiente antes de claims mediante runtime/ledger existentes, sin segundo scheduler ni ejecucion por lectura de status.

## Incremento P1 · autorización de claim (15/11/2026, propuesta)

Sobre main4ceb541, una autorización del host distinta de la observación permite solicitar un único claim sintético fresco mediante los componentes existentes. No se conecta al CLI ni a un scheduler. Identidad por instancia, faseF0, binding, objetivo, revisión y vigencia se comprueban antes; objetivo/versiones/fecha/estado queued se comparan bajo row lock en la misma transacción que local_mission_claim. El ledger sigue controlando token, lease, fencing, intentos y auditoría. Dos candidatos concurrentes no pueden obtener dos claims de esa misión.

La API devuelve únicamente claim/validación de identidad y un contexto sin permisos de ejecución. No devuelve escrituras ni finalización. No constituye autorización para un efecto, autenticación criptográfica de un ejecutor remoto ni operación alojada. La revisión vigente del callback no está transaccionalmente almacenada con SQL: ligar revocación y autorización de efectos durables es la siguiente carencia de P1, junto con atestación independiente antes de completar. P1 parcial, P2 inactiva.

Pruebas: RED de falta de consulta de autorización; regresiones de caducidad/revocación/booleanos/instancia/concurrencia local; PostgreSQL18 desechable con denegación, objetivo/versión/cancelación cambiados y un solo claim. Resultados numéricos y CI exacta en el checkpoint y la única PR del incremento. Rollback: revertir el incremento de esta PR; preservar ledger, grants inciertos y recursos; el camino CLI manual anterior y supervise no se cambian.

## Continuación de ORD-P1-SUPERVISOR-ADAPTER-20261114 · autorización por efecto (15/11/2026, candidata)

Base remota `44dbaeeb6384740da81db2357fb003c7de42d33b`, que integra #239 (`3d6c7a2056603c4ed5796b99cb974e4cb9c23c30`). Reutiliza `PersistentMissionOrchestrator`, `MissionLedger`, `LocalMissionStore`, el claim SQL, lease, token y fencing existentes. Antes de ejecutar un paso o escribir plan, checkpoint, bloqueo, fallo o finalización, el wrapper consulta una operación de un solo uso ligada al grant/revisión, ejecutor seleccionado, misión, objetivo, versiones y vigencia. Solo un paso de objetivo sintético local puede recibir `synthetic_worktree`; no se devuelve permiso de red/envío. `ready_to_complete` requiere un verificador host con identificador distinto, contexto completo consistente y atestación opaca ligada a misión, ejecutor, objetivo, plan y checkpoint, consumida antes de la escritura terminal.

RED/GREEN incluye revocación entre efectos, denegación antes del ejecutor y antes del checkpoint, expiración durante el callback, permisos excedidos, checkpoint terminal incompleto/duplicado, verificador ausente/igual al ejecutor, cambio de contexto y replay de atestación/escritura. `npm run verify` y el CI de `validate`, `postgres` y `CodeQL` se registran para el SHA final de la única PR. No cambia SQL ni se ejecuta laboratorio remoto. Rollback: revertir esta propuesta; #239 y el contrato de claim permanecen en main. No usar este guard en CLI/scheduler automáticamente, no desplegar, fusionar ni activar P2.

**Dependencia aún abierta:** política y revocación durables atómicas con los efectos SQL, más verificación independiente de identidad/capacidad fuera del proceso. El callback y el verificador de esta propuesta son confiables por construcción del host, pero no acreditan un actor remoto. P1 permanece parcial; P2 inactiva.

## Revisión correctiva de PR240 · 16/11/2026

La misma candidata P1 fija la atestación al contexto completo (plan/checkpoint/evidencia/artefactos), rechaza cambios durante callbacks y consume el token tras la última autorización, inmediatamente antes del SQL. La comparación canónica conserva objetivos al reordenar claves JSONB. `observe_state` requiere autorización host propia para usar una copia transitoria con permiso local; ni el supervisor ni el claim conceden permisos persistentes. El recorrido positivo usa la fábrica guarded, planner, ejecutor y ledger reales en PostgreSQL desechable; no basta el camino legacy con permisos precargados.

P1 sigue parcial: callbacks no constituyen revocación durable atómica; la fábrica solo admite misiones frescas, y no se acredita admisión autorizada del checkpoint SQL después de reinicio. La siguiente dependencia es un contrato de revisión/vigencia/revocación durable sobre el ledger existente, tras revisar e integrar con autorización esta corrección. Mantener el límite de recuperación como gate P1; no proclamar P2, identidad remota, hosted SQL o continuidad programada. Evidencia y siguiente prompt en el mismo CODEX_CONTINUATION.json y PR240, sin otra orden o plan.

## Candidata P1 · política durable y recuperación terminal · 17/11/2026

Base main0342d39 tras #240–#243. La política reside en agent_tasks.input, con revisión monotónica, vencimiento, revocación y CAS; no se crea otra autoridad de persistencia. La administración es explícita del host, nunca derivada de una observación. El trigger local serializa escrituras con la revocación bajo el mismo row lock. Nuevas admisiones de efectos releen política después del callback; efectos de filesystem ya admitidos no se deshacen, pero sus escrituras SQL posteriores se deniegan si la política cambió.

La recuperación ready_to_complete es explícita, con lease vencida, versiones exactas y nueva política; conserva claim/lease/fencing y exige atestación independiente nueva sin repetir pasos. Solo admite atestar/finalizar, no observar, replanificar, ejecutar o escribir checkpoints. SQL staged solo local; no migración alojada ni conexión a CLI/scheduler. Pruebas/CAS/carrera observada y recuperación en el mismo checkpoint/PR.

P1 continúa parcial hasta review/integración autorizadas y veredicto formal de salida sobre main real. La siguiente misión de la misma orden es esa evaluación; no se abre P2 por verde sintético ni se declara identidad remota, recuperación general, despliegue o heartbeat ejecutado.

## Reconciliación de integración externa245 · 17/11/2026

#245 integró el núcleo durable y recuperación en main0454ab6 junto con #244. El hardening19f62f9 de transporte/identidad no estaba en ese head; un seguimiento pequeño sobre main actual conserva244 íntegra y lleva solo ese delta. Revisión/CI exacta e integración autorizada antes de evaluación formal de cierre P1. No repetir245, no activar P2, no confundir pruebas de la base previa con el nuevo SHA.
