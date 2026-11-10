# ORD-204E · Entrada y supervisión local de misiones sintéticas

Fecha: 09/11/2026. Base recuperada: PR #210 draft sobre #209, SHA `5403b2fa3067a76adb8601004ee24494b0f280a6`, validate/postgres aprobados. Rama aislada `codex/mission-operator-20261109`, worktree `C:/autopilot-worktrees/mission-operator-20261109`. La propuesta se apila sobre #210, sin fusionar ni reconstruir ORD-204B/C/D.

## Entrada operativa y autorización

[scripts/autopilot-mission.ts](../scripts/autopilot-mission.ts), también `npm run mission:local`, ofrece `init`, `admit`, `run`, `status` y `cancel`. No importa módulos de pruebas ni fixtures. Usa LocalMissionStore (transporte psql local con la forma RPC existente), MissionLedger, PersistentMissionOrchestrator, DeterministicSyntheticPlanner y SyntheticMissionExecutor. El objetivo no incluye plan, reparación ni checkpoint.

La configuración es del host: versión/modo de laboratorio, base local, repo semilla, raíz de worktrees, SHA, permisos separados de admisión/ejecución/cancelación y límites. El request solo admite `id` y el contrato de objetivo ya aprobado en ORD-204D. Cualquier plan, destino, credencial, comando o permiso adicional se rechaza antes de encolarlo. Una admisión idéntica es `duplicate` y no reactiva ni modifica la misión; el mismo ID con otro objetivo produce `admission_conflict`.

Destino único admitido: host literal `127.0.0.1`, puerto explícito y base `victoriosa_mission_operator_lab`. `init` exige base vacía: sin relaciones de usuario en public ni otros esquemas de usuario. Instala solo los archivos fuente de SQL staged y la base de cola, en una transacción. Un marcador con RLS liga esa base a la configuración de recursos del host; los demás comandos exigen ese marcador antes de consultar o escribir misiones. No se aplicó SQL a Supabase alojado. Es un laboratorio de PostgreSQL con un usuario local propietario; no demuestra permisos de operación alojados.

Las credenciales proceden únicamente del entorno/pgpass del host. No se aceptan passwords en el JSON ni se pasan por argumentos de comando. Se descartan PGHOSTADDR, PGOPTIONS y NODE_OPTIONS heredados al lanzar los procesos del transporte; psql usa parámetros explícitos y `-w -X`. Tokens de claim quedan en memoria del host y no salen en status/eventos. IDs `runId` y `local:<UUID>` sirven para atribución, no autenticación criptográfica.

## Comandos reproducibles

Preparación realizada por Codex: PostgreSQL 18 temporal en loopback `55439`, base de nombre reservado, repositorio Git semilla con un solo archivo `synthetic-seed.txt` y contenido `Autopilot disposable synthetic repository v1` terminado en LF, y directorio separado de worktrees. Configuración real sin contraseña en `C:/autopilot-worktrees/mission-operator-lab-20261109/host.json`. Ejemplo de estructura:

```json
{
  "version": 1,
  "mode": "local_synthetic_lab",
  "database": { "host": "127.0.0.1", "port": 55439, "name": "victoriosa_mission_operator_lab", "user": "postgres" },
  "resources": {
    "repository": "C:/autopilot-worktrees/mission-operator-lab-20261109/seed",
    "worktreeRoot": "C:/autopilot-worktrees/mission-operator-lab-20261109/worktrees",
    "baseSha": "aafa5bc7085d44289c36d22192d517a6ac1097b8"
  },
  "permissions": { "admit": true, "execute": true, "cancel": true },
  "leaseSeconds": 15,
  "deadlineMs": 12000,
  "queryTimeoutMs": 2000
}
```

Para otro laboratorio, crear su base vacía y repo semilla, obtener su SHA mediante `git rev-parse HEAD` y sustituir rutas/SHA/puerto. La configuración real anterior corresponde a la evidencia local, no a otra máquina. Inicializar una sola vez la base vacía: `npm run mission:local -- init --config RUTA_HOST_JSON`. La base ya inicializada rechaza repetir init.

Desde el worktree de esta rama, con PostgreSQL local iniciado:

```powershell
$missionHost = 'C:/autopilot-worktrees/mission-operator-lab-20261109/host.json'
npm run mission:local -- admit --config $missionHost --request docs/examples/LOCAL_SYNTHETIC_MISSION_REQUEST.json
npm run mission:local -- run --config $missionHost --id synthetic-manual-entry
npm run mission:local -- status --config $missionHost --id synthetic-manual-entry
npm run mission:local -- cancel --config $missionHost --id synthetic-manual-entry
```

[Request de ejemplo](examples/LOCAL_SYNTHETIC_MISSION_REQUEST.json). Cancelar una misión ya cerrada devuelve `changed:false`; para cancelar una activa, ejecutar cancel desde otro proceso mientras run está activo. El comando run atiende solo ese ID: no toma trabajos ajenos ni recorre otra cola. Exit 3 indica otro ejecutor activo; exit 2, error o interrupción incompleta. Exit 0 informa el estado consultado, que puede ser completed, blocked o cancelled: no significa por sí solo que el objetivo se cumplió.

## Supervisión y cancelación

Cada run obtiene UUID propio, claim atómico con SKIP LOCKED y token nuevo. Durante su vida, una supervisión en el mismo proceso consulta estado cada 250 ms, sin crear un servicio o scheduler. Cancelar actualiza el estado a `cancelled` (queueState `blocked`), revoca el token y registra `mission_cancelled`; el ejecutor detecta el cierre, aborta y espera el fin de sus hijos. El cierre de carrera se decide en PostgreSQL: si completed ganó primero, cancel no lo sustituye.

ManagedProcesses controla Git, Node y psql del run: grupos de procesos propios en POSIX, árbol del PID propio mediante taskkill en Windows. Cancelación/timeout esperan el cierre; una prueba comprueba también la terminación del descendiente de un hijo. El transporte impone statement_timeout para que una consulta no quede sin límite si el padre muere por SIGKILL. No se garantiza terminación instantánea de todos los descendientes ante una muerte no capturable del host.

Timeout o señal capturable del operador registran, con el token propio, un fallo retryable (`run_timeout` / `operator_interrupted`) y conservan el backoff de la cola. SIGKILL deja el estado durable y el lease: otro run manual puede reclamar al vencer. Se preservan tres intentos por defecto, hasta ocho pasos y dos replanificaciones como techo del dominio; el objetivo de ejemplo admite una. El plazo de run nunca alcanza el vencimiento del lease; Git conserva 15 s, prueba 10 s y consultas un máximo configurable de 5 s.

## Demostración ejecutada fuera del test runner

Se ejecutó directamente `node --import tsx scripts/demo-local-missions.ts RUTA_HOST_JSON RUTA_EVIDENCIA_JSON`, sin node:test. El driver llama los mismos comandos operativos desde procesos separados. Solo prepara objetivos e inyecta una espera en el RPC de checkpoint; este delega al RPC original. No suministra planes, correcciones ni checkpoints. La espera de instrumentación se retira al terminar.

| Caso observado | Orden / run | Estado y evidencia |
| --- | --- | --- |
| Admisión y ejecución manual | `synthetic-cli-normal-13d4cfd7` / `7faafa90-4250-4b71-89b2-9ca37b2ebfce` | completed; checkpoint 5; intento 1; 7 eventos; admisión concurrente única y duplicado sin nuevo evento |
| SIGKILL y relanzamiento manual | `synthetic-cli-recover-13d4cfd7` / `a508212e-a1f2-486e-8e5e-3df1215519ce` | completed; checkpoint 5; intento 2; 8 eventos; lease vencido naturalmente, sin inyectar su expiración |
| Dos ejecutores compitiendo | `synthetic-cli-compete-13d4cfd7` / `96727a44-b862-452a-b901-2d69a7608691` | uno ejecuta, otro busy; completed con un solo intento |
| Cancelación desde otro proceso | `synthetic-cli-cancel-13d4cfd7` / `5074259c-039e-4527-a7ee-1a22b03c8468` | cancelled / cancelled_by_operator; hijo terminado; cero hijos pendientes; duplicar admisión no reactiva |
| Timeout del host | `synthetic-cli-timeout-13d4cfd7` / `a5ab6181-5b1a-40e2-9256-f225fdb930b0` | retry_wait, queueState failed, motivo run_timeout; hijo terminado y cero pendientes |
| Destino, recursos y permisos | Requests rechazados antes de ejecutar | destino remoto, recursos sin binding, ejecución/cancelación sin permiso, plan/credenciales adicionales y objetivo no admitido rechazados |

La recuperación ocurrió después de escribir ambos archivos y antes del checkpoint de modify-v1. Otra consulta CLI observó el progreso con solo prepare-v1 confirmado. Después de SIGKILL, el psql huérfano terminó por el timeout de consulta; se esperó el lease natural, se relanzó run y se comprobó token viejo rechazado con el nuevo propietario activo. El plan v1 permaneció; modify-v1 produjo `synthetic_effect_reconciled` y ambos mtimes se conservaron.

Auditoría del caso recuperado: `mission_admitted → six_agent_claim → mission_plan_saved → mission_checkpoint_saved → six_agent_claim → mission_checkpoint_saved → mission_checkpoint_saved → six_agent_complete`. Status entrega plan/versiones, resultados, evidencias, motivo, intentos, run y auditoría, sin token. Registro completo local: `C:/autopilot-worktrees/mission-operator-20261109-evidence.json`; logs de demostración, verify y regresiones en ese mismo directorio padre.

## Validación y revisión adversarial

`npm run verify` exit 0: 454/454, sin omitidos, tipos, 13 skills y ambos builds. Siete pruebas nuevas cubren admisión/configuración/entorno y terminación de hijos/descendiente. La prueba PostgreSQL de entrada operativa ejecuta el driver normal desde fuera del runner y pasa sus seis casos; también verifica que init rechaza un esquema privado preexistente sin instalar tablas. Regresiones ORD-204C 3/3 y ORD-204D 13/13 aprobadas. El mismo caso se incorporó al job postgres existente; validate/postgres del SHA final se informan en la PR.

La revisión adversarial reprodujo en rojo una admisión incorrecta del laboratorio cuando solo se comprobaban tablas de public. Se corrigió exigiendo ausencia de esquemas de usuario y relaciones; el negativo y el arranque posterior sobre base vacía pasaron. También se verificaron admisiones simultáneas, objetivo conflictivo bajo un ID, cancelación idempotente, no reactivación por duplicado, ambiente redirigido, token obsoleto, contención y procesos terminados.

Para respetar sin despliegues, vercel.json desactiva Git deployment solo para esta rama, mediante [git.deploymentEnabled](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled). No se cambian otras ramas ni configuración alojada. Supabase Preview omitido no demuestra integración; tampoco se ejecutó SQL alojado.

## Transferencia, límites y siguiente tramo

**Demostrado:** entrada operativa manual y recuperación persistente mediante relanzamiento manual. Autopilot admite, encola, reclama, deriva, ejecuta, supervisa, expone evidencia y cancela este dominio sin importar un arnés de pruebas. El driver es evidencia, no dependencia de la entrada. Ningún disparador desatendido fue utilizado u observado; no se acredita funcionamiento permanente.

Codex preparó PostgreSQL/recursos/configuración, lanzó comandos y la demostración, inyectó fallos mediante el driver y revisó evidencia. Una persona o un ejecutor autorizado todavía debe iniciar run y relanzarlo tras una pérdida no capturable. La siguiente dependencia a reducir es conectar esa entrada a un disparador **existente**, autorizado y observado, sin otro scheduler y sin ampliar el dominio por inercia.

Permanece el aislamiento lógico de worktree/allowlist, no sandbox OS de código arbitrario. El fencing demostrado es SQL: no se extiende a escrituras de filesystem. Los efectos permitidos previos a cancelar o interrumpir pueden quedar en el worktree; no se borran como supuesto rollback. No hay planificación general ni independencia completa. Puertas F1→F2→F3→F4 intactas, sin merge, despliegue, gasto, credencial nueva o envío. Se detienen los servidores temporales al cerrar y se conservan sus datos/evidencia; no se instala un servicio permanente.
