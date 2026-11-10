# ORD-204F · Auditoría del disparador y propuesta de integración

Fecha de inspección: 09/11/2026; corte de disponibilidad del host 23:33 UTC. **Resultado parcial: integración preparada para revisión; arranque directo y recuperación automática no demostrados.** No se modifica ningún disparador. La incompatibilidad de infraestructura impide realizar honestamente el circuito exigido con los mecanismos disponibles y los límites de esta orden.

Base contrastada: [PR #211](https://github.com/Victoriosas/autopilot/pull/211), draft sobre #210, `ee34ef0501130b112e4023afb3cd1c8e04db8b05`. Se preservan ORD-204B/C/D/E y sus commits en la rama aislada `codex/mission-trigger-20261109`, worktree `C:/autopilot-worktrees/mission-trigger-20261109`. No hay PR equivalente entre las propuestas abiertas inspeccionadas. Main sigue en `a6cff5aba04e752cb010926b88c24fd4abfe84b6`; sus cambios locales sin seguimiento se conservan. Esta propuesta no cambia lógica de aplicación ni SQL.

## Disparadores inspeccionados

| Mecanismo | Ejecución, identidad y recursos | Evidencia e incompatibilidad |
| --- | --- | --- |
| `victoriosa-autopilot-6h` | Heartbeat local de Codex, ACTIVE, cada seis horas, chat `01a0e385-4c88-7b52-bdc1-4ccdb19311e8`. Prompt indica trabajar en `C:/autopilot`. Cuenta del host observada: `micahael-pc/micahael`; no se comprobó por separado el propietario efectivo de un futuro hijo del scheduler. | Es un prompt interpretado por Codex, sin comando CLI ni configuración PostgreSQL. El checkout principal no contiene todavía ORD-204E. El estado ACTIVE no prueba disponibilidad ni ejecución directa. |
| GitHub `victoriosas-infrastructure-availability.yml` | Programación existente cada seis horas, `ubuntu-latest`, permisos `contents:read`, `id-token:write`. Ejecuta `scripts/agent-health-queue.mjs`; grupo de concurrencia propio, sin cancelar el run activo, timeout tres minutos. | Run programado `42712426229`, 09/11 22:30:07 UTC, success. No es la cola local de misiones sintéticas ni tiene acceso al loopback de Windows. |
| GitHub `victoriosas-public-health.yml` | Programación cada seis horas, `ubuntu-latest`, `contents:read`, timeout cinco minutos. Ejecuta `scripts/public-health.mjs`. | Run programado `42713029839`, 09/11 22:34:05 UTC, success. Monitor público, sin entrada a misiones locales. |
| GitHub observabilidad / zero-cost audit | Jobs diarios en `ubuntu-latest`, scripts de informe existentes. | Runs `42545237098` y `42545154598`, 09/11 01:22:29 y 01:21:34 UTC, success. Informes, no ejecutores del dominio local. |
| Vercel cron `/api/autopilot/v4/cron/sourcing` | Cron de seis horas definido en `vercel.json`; handler protegido por CRON_SECRET, gates de sourcing y almacenamiento propios. | El handler de `src/autopilot/sourcingRouter.ts` no llama la CLI ni usa el laboratorio. La configuración en Git no acredita un disparo desplegado. Cambiarlo exigiría despliegue y recursos remotos fuera de la orden. No se invocó ni se activó sourcing. |
| Windows / OpenCode | Consulta de tareas programadas por nombres autopilot/victoriosa/codex/opencode/six.agent sin coincidencias. `tools/opencode-workstation/scripts/control.mjs` ofrece una ejecución acotada mediante el agente director de OpenCode. | No se encontró un disparador nativo del proyecto en esa búsqueda; no es un inventario exhaustivo de todos los procesos del sistema. El control de OpenCode no es un scheduler y añade otra dependencia de un agente. No se lanzó. |

API de runners del repositorio: `total_count:0`; no hay runner self-hosted registrado que conecte los jobs de nube con esta PC. La red local de un runner Ubuntu no es `127.0.0.1` de Windows. No se propone exponer PostgreSQL, agregar credenciales ni instalar un runner o servicio.

## Historia real del heartbeat

La lectura de metadatos locales y la consulta del chat mediante `wait_threads` coinciden:

- Último disparo registrado: 09/11/2026 **18:00:24.711 UTC**.
- Turno `01a1c177-f6e1-7890-870a-e82e9272603a`, inicio **18:00:27 UTC**, fin **18:01:54 UTC**, estado completed; chat idle al inspeccionarlo.
- Su resultado fue una comprobación pública que terminó por timeout local. No contiene un run ni una misión de la CLI. `completed` del turno no significa objetivo operativo completado.
- Próxima ejecución anunciada por los metadatos al inspeccionar: **23:57:29.692 UTC**. Es una fecha prevista, no observada ni garantizada. No se la adelantó ni se disparó manualmente.
- La tabla local `automation_runs` no devolvió filas para este heartbeat, en las dos bases de metadatos inspeccionadas. No se puede deducir de ello ausencia de actividad: el turno anterior sí existe. No hay evidencia suficiente para certificar historial completo, exclusión de solapamientos o reintentos del scheduler. No se inventa una política de reintentos.

Archivo del host inspeccionado: `C:/Users/micahael/.codex/automations/victoriosa-autopilot-6h/automation.toml`. SHA256 inicial `072516fe583f4aabd0bf6f11b1dc60bc6db5b3c226d4f80c2d98cc896e50e795`. La API de automatizaciones ofrece prompts; no se observó una opción de comando nativo directo. Leer estado o la configuración no demuestra ejecución durante una desconexión. Una PC apagada no puede ejecutar procesos locales; no se probó recuperación del heartbeat tras reinicio o cierre de Codex.

## Disponibilidad del laboratorio

`pg_ctl status` devolvió **no server running** para ambos laboratorios temporales preservados: puerto 55439, `C:/autopilot-worktrees/queue-fencing-20261109-pg`, y puerto 55441, `C:/autopilot-worktrees/mission-operator-verification-pg-20261109`. No se arrancaron para aparentar disponibilidad continua. El servicio preexistente `postgresql-x64-18` está Running/Automatic; no es evidencia del laboratorio autorizado y no se reutilizó ni cambió.

La CLI exige base desechable local con nombre reservado, marcador de binding, repo semilla y worktrees accesibles. La configuración real de E es `C:/autopilot-worktrees/mission-operator-lab-20261109/host.json`; contiene permisos de preparación más amplios que los que necesitaría el disparador. El scheduler necesitaría una copia del host con **admit:false, execute:true, cancel:false**, mismos recursos/base y límites válidos; no se crearía desde el payload ni se almacenarían credenciales en Git. El binding existente conserva los recursos al separar esos permisos. Preparar, iniciar y mantener disponible la base sigue requiriendo intervención autorizada del operador/Codex.

## Cambio mínimo propuesto, NO aplicado

Con el mecanismo actual solo cabe una integración **mediada por Codex**, que no satisface arranque directo independiente. Se propone añadir el siguiente bloque a las instrucciones existentes del heartbeat, sin reemplazar sus obligaciones, su identidad, su chat, su frecuencia ni sus notificaciones. Debe revisarse antes de usarlo porque hoy faltan base disponible, configuración de ejecución y vínculo de auditoría del disparo. No hay instalación ni activación implícita por publicar esta propuesta.

> Integración sintética ORD-204F, pendiente de habilitación del host: atiende únicamente la misión previamente admitida `synthetic-trigger-ord204f`. Antes de ejecutarla, comprueba el SHA aprobado y el checkout aislado, la configuración de ejecución del host y el laboratorio local disponible. No prepares ni arranques infraestructura, no admitas objetivos y no cambies recursos o credenciales. Si falta una precondición, informa el bloqueo y termina esta integración. Consulta el estado mediante la CLI existente; no ejecutes misiones completed, blocked o cancelled. Invoca run una sola vez para ese mismo ID; no elijas pasos, no repares archivos ni checkpoints y no relances en un bucle. Ante busy, backoff o presupuesto agotado, conserva el estado y espera el próximo disparo normal. Conserva el ID real del disparo/turno, hora de inicio, SHA y los runId de la salida de la CLI en una evidencia del host. Un rótulo aportado por el proceso sirve para atribución, no prueba origen ni autenticación. Si no puede obtenerse el vínculo real del scheduler, no atribuyas el run a un disparo automático. Una pérdida del ejecutor debe recuperarse exclusivamente en otro disparo normal del mismo heartbeat.

Comandos ya disponibles, **propuestos para ese entorno futuro, no ejecutados como prueba F**:

```powershell
Set-Location 'C:/autopilot-worktrees/mission-trigger-20261109'
$missionHost = 'C:/autopilot-worktrees/mission-operator-lab-20261109/execution-host.json'
node --import tsx scripts/autopilot-mission.ts status --config $missionHost --id synthetic-trigger-ord204f
node --import tsx scripts/autopilot-mission.ts run --config $missionHost --id synthetic-trigger-ord204f
```

`execution-host.json` aún no está preparado ni habilitado. La admisión sería una operación separada del propietario con el [objetivo estructurado de E](examples/LOCAL_SYNTHETIC_MISSION_REQUEST.json), sustituyendo únicamente el ID; no se incluye un plan. El disparador no recibe JSON del solicitante como argumentos de comando. La CLI sigue aceptando un ID concreto; no se agrega selector, cola, scheduler ni proceso permanente. Una ampliación futura a seleccionar pendientes necesita otra implementación y sus pruebas de exclusión/alcance; no se improvisa consultando la primera fila de agent_tasks.

La correlación propuesta debe guardar: ID del heartbeat, chat y turno reales, timestamp del disparo, SHA ejecutado, missionId, runId emitido, estado final, intentos y auditoría obtenida por status. Debe contrastarse con la fuente del scheduler. La CLI actual emite `manual:true`: no se cambiará ese dato para aparentar ejecución directa; este circuito sería una invocación CLI por Codex. La correlación externa por sí sola no es un nuevo control de autenticación ni un enlace durable ya implementado en el ledger.

Reversión propuesta: retirar únicamente el bloque añadido mediante la API de automatizaciones y restaurar el prompt previamente guardado, conservando todos los demás campos. Como no se aplicó, no hay nada que revertir hoy. No editar TOML/SQLite para simular un disparo o cambiar sus tiempos. Para una invocación directa sin Codex se necesita un mecanismo autorizado con acceso real al host; ninguno de los inspeccionados ofrece esa capacidad para este laboratorio dentro de los límites actuales. No se solicita ni se instala otro scheduler como sustituto.

## Criterios observados y pendientes

| Criterio | Resultado ORD-204F |
| --- | --- |
| Admisión / run / estado / cancelación manual | Ya probados en E; [evidencia previa](MISSION_OPERATOR_ORD204E_20261109.md). No se presentan como nuevos runs F. |
| Arranque automático mediante Codex | Heartbeat real observado para diagnóstico público; CLI sintética no vinculada. |
| Arranque directo de Autopilot sin Codex | NO DEMOSTRADO; no hay disparador compatible observado. |
| Interrupción tras efecto y recuperación por segundo disparo | NO EJECUTADA en F; no hay missionId/runId F que atribuir. |
| Lease natural, reconciliación, token viejo, contención, cancelación | Pruebas de E preservadas. No acreditan actuación de un disparador. |
| Duplicados / presupuesto agotado / fallo del disparador | Revisión del contrato y regresiones existentes, sin nueva prueba integrada de scheduler. Pendientes en un circuito real. |
| Operación durante reinicio/desconexión y permanente | NO DEMOSTRADA. Depende de PC, Codex para heartbeat, PostgreSQL temporal y recursos/configuración del host. |

Para cerrar F deben observarse dos disparos naturales del mismo mecanismo: primer run de la misión ya admitida, SIGKILL después del efecto y antes del checkpoint, expiración natural del lease y segundo run con reconciliación, intento nuevo y token anterior rechazado. El arnés solo observa/instrumenta la interrupción; no inicia el segundo run. Deben repetirse duplicados, contención, cancelación y presupuesto agotado desde la misma entrada. Si solo ocurre el primero, guardar su resultado y continuar pendiente; no adelantar horarios. Preparar otra prueba iniciada por Codex repetiría E y no resolvería este bloqueo.

## Validación y revisión crítica

Cambio limitado a documentación y al rechazo de Git deployments para `codex/mission-trigger-20261109` en `vercel.json`, añadido **antes del primer push**, conservando el bloqueo de E. No cambian cron, handlers, SQL, cola, ledger, planificador, ejecutor ni controles de cancelación/fencing. No se aplicó SQL alojado. La CI del SHA final y la ausencia de Preview se comprobarán en la PR; los checks de la base no se atribuyen al nuevo SHA.

Validación local de esta propuesta: `npm run verify` exit 0, 454/454 pruebas, cero omitidos, tipos, 13 skills y ambos builds. Log local `C:/autopilot-worktrees/mission-trigger-20261109-verify.log`. Enlaces locales del documento y estructura de `vercel.json` comprobados: el único cambio de configuración es añadir el bloqueo de deployments de esta rama. Secret scan aprobado. Checkpoint añadido conservando íntegros los bytes y finales CRLF del historial anterior. No se arrancó PostgreSQL local para repetir E; las regresiones de PostgreSQL C/D/E quedan a cargo del job postgres existente del SHA final, sin atribuir sus relanzamientos de prueba a un disparador operativo.

Revisión adversarial: un success de monitor no acredita una misión; un turno completed no acredita su objetivo; un ID de trigger declarado no autentica origen; loopback del cloud no alcanza esta PC; reutilizar un servicio PostgreSQL ajeno no demuestra disponibilidad del laboratorio; modificar un prompt conserva dependencia de Codex; correr un arnés desde CI no es un segundo disparo operativo. La propuesta conserva ID fijo admitido, permisos del host, claim atómico, lease/fencing SQL, backoff, cancelación durable y presupuestos existentes. No amplía fencing SQL a filesystem ni garantiza que un scheduler reinicie hijos. No se agrega recuperación automática que el runtime no ofrece.

Función transferida en esta orden: **ninguna nueva función operativa demostrada**; se obtuvo el diagnóstico verificable del iniciador y una propuesta acotada revisable. Codex aún prepara el host, interpreta el heartbeat e inicia/reinicia la CLI cuando está autorizado. El bloqueo es infraestructura accesible y origen real de los disparos, no falta de un plan o de lógica de recuperación. Se mantienen N2 sintético y las puertas de producto existentes; sin planificación general, independencia completa, merge, producción, gastos, credenciales nuevas o envíos.
