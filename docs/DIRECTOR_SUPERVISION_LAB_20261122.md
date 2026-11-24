# Cloud Director: ciclo SQL de laboratorio y dependencias de activación

Fecha: 22/11/2026. Alcance: F0, continuación acotada de `ORD-AUTONOMOUS-ENGINE-01`, según la petición actual de prueba sintética. **PROBADO local; NO ejecutado alojado, NO autonomía real.** Se extiende PR #274, sin otra PR ni arquitectura paralela.

## Reconciliación
- Main reconsultado: `82b6fb24e76d81e5026c94af2630358d00f2ebe9`.
- #272: fencing de `six_agent_fail`, ACL y métricas; revisión del head `cb67032cd2319b622f5868590e14dc291c1ce001`. Su checkpoint candidato usa `ORD-AUTONOMOUS-ENGINE-01` y mantiene las barreras alojadas. El checkpoint de main aún describe la orden anterior de demostraciones; no se sobrescribe ese historial ni se reabre P2.
- #273: head revisado `009713fc5e444176bf97f8e7ffa3287b4ae849c4`, preflight autenticado, registro canónico y cron **comentado** `*/30 * * * *`. No duplicar ese handler o SQL.
- #274: observador `observeAgents`, API administrativa y panel. Este incremento añade exclusivamente un laboratorio reproducible a esa misma PR.
- Jobs de #272/#273: las consultas a logs de `validate` no devolvieron logs. La atribución a bloqueo de facturación consta en sus informes, pero esta sesión no obtuvo anotaciones ni evidencia independiente nueva de la causa. No es prueba de defecto del código; tampoco CI aprobada. No se reintentaron runs manualmente ni se cambió facturación/Actions.
- Auditoría aportada por el propietario: principal `jfjzpwlrhzqbcrvqxhzf` tiene pg_cron, no pg_net ni ciclo Director; `six_agent_fail` alojada no verifica lease. Se mantiene como evidencia externa identificada, sin fingir una nueva consulta SQL alojada.

## Implementación sin otro ledger
Se reutilizan las funciones versionadas `six_agent_claim_mission`, `six_agent_checkpoint`, `six_agent_complete`, `six_agent_fail`; el adaptador `createMissionLedger` y `PersistentMissionOrchestrator`; y `observeAgents` de #274. El transporte psql añadido está bajo `tests/fixtures/`, restringido a loopback/base desechable y no se monta en API, Edge, CLI operativa, registro de ejecutores ni scheduler.

El runner crea un clúster propio en un directorio temporal, autenticación SCRAM, puerto loopback efímero y contraseña aleatoria no impresa. No instala herramientas ni descarga servicios. Exige la migración original de #272 mediante un archivo externo y verifica sus bytes SHA-256 `9c36d6949b3f44c24605cf57b2bd634fc202d22708aa4b7a1c7b9bac88f7e9a1`; **no copia ni modifica el SQL pendiente de esa PR**. La aplica después del esquema staged de checkpoints solo dentro del clúster creado por el runner.

Tablas de negocio/auditoría siguen siendo `agent_tasks`/`agent_audit_events`. La única tabla adicional es un centinela efímero de prueba, no un almacén operativo. Se eliminan el clúster, credencial y centinela al terminar; si no se confirma parada, no se borra el clúster. Una terminación forzada del host puede exigir limpieza manual de su directorio temporal: no es un daemon ni garantía de recuperación del propio sandbox.

## Ensayo y evidencia
1. Crea una misión sintética `director` con dos pasos fijos (observar ledger y comprobar observación persistida), `no_send`/`no_dispatch`, más cinco filas de configuración sintética de los otros roles.
2. Un proceso hijo usa el runtime existente y persiste los seis IDs canónicos con disponibilidad `unknown` en el checkpoint 1. No se certifica actividad por figurar `ready` ni por un claim.
3. Un trigger sintético rechaza la auditoría del checkpoint 2. PostgreSQL revierte conjuntamente el checkpoint y el evento: permanece versión 1, con un solo evento confirmado. El runtime se detiene, sin convertir la escritura incierta en una segunda escritura de fallo.
4. Otro proceso no puede reclamar mientras la lease siga vigente. Replay idéntico del checkpoint 1 no duplica auditoría.
5. Tras vencer realmente la lease (25 segundos en este transporte de prueba), el token anterior no puede llamar a fail ni guardar checkpoint.
6. Un proceso nuevo reclama con nuevo token y reanuda únicamente `verify-observation`. Final: `completed`, intento 2, checkpoint 3; dos eventos de checkpoint, observación original preservada.
7. Finalización con token anterior rechazada; ciclo ya completo no se repite; los otros cinco roles conservan cero intentos y estado queued. No hay pg_cron ni pg_net en el clúster.

Resultado reproducido con PostgreSQL 18.6, Node 24: **1 prueba SQL aprobada, cero fallos/omisiones**. Dos ejecuciones en clústeres distintos aprobaron (la segunda mediante el runner del repositorio). No se usa memoria ni JSON local como sustituto de persistencia: las lecturas posteriores se realizan mediante sesiones SQL nuevas y procesos Node distintos. La evidencia independiente de la ejecución es la lectura SQL del proceso padre; no es una atestación remota ni una auditoría entre autoridades separadas.

Limitaciones: esquema mínimo sintético, propietario SQL del laboratorio, sin PostgREST/Auth reales ni validación TLS/remota de permisos; prueba composición/atomicidad/fencing/recuperación, no privilegios productivos ni recuperación genérica de efectos comerciales. El ejecutor es exclusivamente fixture, no agente comercial. No se demuestra ciclo periódico ni continuidad tras apagar este sandbox.

## Reproducir sin credenciales alojadas
Prerrequisitos: Node 24, `npm ci`, PostgreSQL 18 con `initdb`, `pg_ctl`, `createdb` y `psql`, usuario local no root. No hace falta Docker, pg_cron o pg_net. No se añade dependencia de aplicación.

En un checkout de #274, preparar fuera del árbol un checkout separado del head revisado de #272, sin fusionarlo. Configurar solo rutas no secretas:

```sh
export DIRECTOR_LAB_PG_BINDIR=/ruta/absoluta/postgresql/18/bin
export DIRECTOR_LAB_LEASE_FIX_SQL=/ruta/checkout-pr272/supabase/migrations/20261122045000_six_agent_fail_lease_fencing.sql
npm run test:director-supervision:db
```

`createdb`/`psql` deben estar en PATH; si es necesario se admiten `CREATEDB_PATH`/`PSQL_PATH`. El runner genera su contraseña; no pide tokens, contraseñas ni DSN alojados. La prueba rechaza destino remoto, base diferente y parámetros de conexión antes de cualquier consulta. No apunta al laboratorio alojado `juyowvmtluxfetgkckjd`.

La prueba SQL explícita falla si faltan prerrequisitos; no se cuenta como aprobada u omitida dentro de `npm run verify`, que sigue siendo la validación de aplicación independiente. En la última ejecución local de `npm run verify` se aprobaron tipos, builds Node/Vercel y smoke de API compilada: **621/621 tests, 0 fallos y 0 omisiones**. `node scripts/secret-scan.mjs` y `git diff --check` también aprobaron; el escáner detectó primero el marcador sintético largo de una prueba como posible secreto, se acortó ese fixture sin cambiar el comportamiento y el escaneo posterior pasó. CI remota debe consultarse para el SHA final; no heredar los resultados del padre.

## Diseño del adaptador persistente seguro
No hace falta sustituir `CloudMissionStore` ni `createMissionLedger`:
- **Lectura técnica:** `CloudMissionStore.status()` sobre el ledger aislado existente, usando binding, identidad fijada, libpq y TLS verify-full. Este transporte requiere un host con psql; no asumir que Vercel Functions o Supabase Deno pueden ejecutar ese binario.
- **Checkpoint/claim/completion:** las RPC existentes a través de `createMissionLedger` conservan tokens en el host y fuera del ejecutor. La proyección de estados no concede autoridad para invocarlas.
- **Claim Director local implementado, no activado:** `CloudMissionStore.directorClient()` traduce exclusivamente las operaciones permitidas a RPC dedicadas de `director` en SQL staged. El claim exige misión fija, binding, SHA base revisado, slot UTC vigente, ID durable de autorización, identidad SQL dedicada con TLS y `no_send/no_dispatch`; el selector genérico de los otros agentes no se amplía. La autorización y revocación usan revisión compare-and-set y el claim/checkpoint/fail/complete vuelven a validar el grant y fencing en la transacción. Solo se ensayó en una base desechable.
- **Ejecución Director sintética implementada, no conectada al runtime alojado:** `DirectorSyntheticExecutor` reusa `observeAgents`, el ledger y `PersistentMissionOrchestrator` existentes. Lee exclusivamente filas fixture; separa evidencia declarada y no verificada, expone `evidenceVerified=0` y `runtimeStatus=unknown`, y verifica el checkpoint persistido desde otra sesión antes de completion. `consumeDirectorSyntheticHandoff()` adapta el handoff existente, pero no está llamado desde un workflow/servicio y no despacha por sí mismo.
- **Identidad y aislamiento:** cotejar el marcador/binding de laboratorio, recursos, actor, misión, SHA revisado y versiones antes del claim. Rol SQL mínimo, sin superusuario/BYPASSRLS ni grants navegador; una credencial admin no prueba mínimo permiso.
- **Seguridad de resultado:** lectura acotada, agregados sin PII; no transferir evidencia cruda al cliente. Ejecutor sin claves, sin cliente SQL/RPC y sin selección arbitraria de herramientas. Solo observación/checkpoint autorizados, cuotas deterministas y kill switch.

## Preparación de 30 minutos: sin activar
Se conserva el SQL comentado de #273, sin nuevo Cron, archivo de schedule ni workflow. Frecuencia propuesta: `*/30 * * * *`; almacenamiento en UTC y presentación `America/Montevideo`. Reconciliar primero los jobs existentes, incluido cualquier heartbeat local, para no crear dos dueños de una misma misión.

El SQL staged acota claim a un ID sintético fijo y slot UTC de 30 minutos, registra una única identidad de slot por tarea, excluye un segundo claim mientras la lease vive y permite recovery solo después de su expiración con fencing nuevo. La prueba verifica replay del mismo slot, dos workers concurrentes y renovación de autorización. **No** implementa admisión/creación automática de tareas por cada intervalo ni exclusión de schedulers entre hosts; #273 permanece sin tocar y su Cron sigue comentado.

## Dependencias exactas del primer ciclo alojado
| Puerta | Evidencia necesaria | Estado actual |
|---|---|---|
| Seguridad #272 | Revisión e integración separadas; la prueba local requiere y valida por SHA la migración de lease de #272 como archivo externo | PR abierta en head `cb67032cd2319b622f5868590e14dc291c1ce001`; migración NO aplicada alojada |
| Entorno ledger | Confirmar `juyowvmtluxfetgkckjd`, marcador/binding, tablas, índices, funciones queue/checkpoint y política/grants efectivos, sin datos de principal | No reconsultado aquí |
| Runtime | Host cloud existente con psql/TLS para CloudMissionStore, o transporte RPC revisado compatible; identidad dedicada, permiso durable por efecto y verificador independiente | No conectado por esta prueba |
| Conexión | Credencial exclusiva de lab, CA/verify-full, identidad sin bypass, DNS/ruta accesible desde el host autorizado | No disponible/verificado en esta sesión |
| Credenciales | Responsable introduce valores en el entorno elegido, nunca chat/Git; no copiar credenciales de principal a Preview ni usar service_role como token wake | Pendiente de configuración aislada |
| Wake #273 | Revisión; despliegue aislado autorizado del preflight y pruebas 401/503/200; después integración específica al ciclo, sin equiparar preflight a ejecución | Solo preparación |
| Disparo | Reconciliar jobs; aprobación posterior de un único mecanismo. La ruta Supabase necesita pg_net/Vault y ACL/retención de encabezados revisados; no instalarlos ahora | No activado |
| CI | Checks exactos utilizables/aprobados o causa externa clasificada con anotaciones oficiales; resolver facturación solo por el titular | En #272, #273 y el head #274 `8892d2b10c204627b1b5efc661e8e052ef247cc7`, validate/postgres/CodeQL/browser fallaron antes de iniciar jobs. Las anotaciones oficiales dicen: “The job was not started because your account is locked due to a billing issue.” No es un fallo de código ni una CI aprobada. No se reintentaron; propietario debe resolver bloqueo de facturación de GitHub. |
| Cuotas | Uso/costo de worker, DB, red y límite por ciclo medidos; máximo 1 ciclo concurrente, deadline/reintentos y parada por error/presupuesto | No medidos alojados |
| Admisión | Misión sintética única de observación, `no_send`, `no_dispatch`; revisar slot idempotente, actor/rol y política; nunca reclamar una misión comercial | Solo fixture local |
| Recepción independiente | Un observador distinto consulta attempts/token sustituido/checkpoint/auditoría; induce fallo autorizado, reanuda y comprueba no replay/no envíos | Demostrado solo local |

GitHub puede alojar el worker a través del workflow PLAN Cloud existente, pero no es una salida efectiva mientras sus runners estén bloqueados. Vercel continúa con la UI/API administrativa; no se añade una dependencia del PC ni un bucle serverless. La alternativa Edge de #273 es un preflight y todavía requiere adaptar/revisar el ciclo: no basta instalar pg_net.

## Cambios y rollback
Archivos nuevos: adaptador/ejecutor Director, prueba focal, SQL staged Director, fixture y runner PostgreSQL aislado; modificaciones acotadas al transporte `CloudMissionStore`, lease configurable con default conservado, prueba SQL de recuperación y status API fail-closed que ya no consulta filas del ledger productivo. El runner temporal usa SCRAM, TLS localhost verificado y credenciales aleatorias no impresas; apaga y elimina el clúster solo tras confirmar `pg_ctl stop`. No se modifica el handler/wake/Cron de #273 ni se aplica el SQL de #272. El panel no se conecta a este lector: el endpoint de status responde 503 hasta configuración explícita. Revertir el cambio en la misma PR retira el adaptador, prueba y SQL staged; no hay servicio/scheduler que apagar.

## Actualización de implementación y reconciliación · 22/11/2026

- Rama existente de PR #274: `codex/cloud-director-observation-20261122`; base `main` `82b6fb24e76d81e5026c94af2630358d00f2ebe9`; head remoto antes de este incremento `8892d2b10c204627b1b5efc661e8e052ef247cc7`. #274 continúa abierta/draft y sin review humana. No se creó otra PR.
- #272 sigue abierta, head `cb67032cd2319b622f5868590e14dc291c1ce001`; #273 sigue abierta, head `009713fc5e444176bf97f8e7ffa3287b4ae849c4`. Ambas se reutilizan como dependencias; no se cambiaron sus ramas ni archivos.
- PostgreSQL 18 desechable, loopback-only, SCRAM y TLS `verify-full`: prueba específica aprobada después de incorporar la validación de grant ID obsoleto. Cobertura: dos workers simultáneos (un único intento), replay del slot, rollback del checkpoint rechazado, checkpoint durable, lease vencida, revocación a mitad del proceso, nueva autorización compare-and-set, rechazo del ID/token antiguo en claim/checkpoint/fail/complete, lectura agregada independiente concordante, cero claims de otros agentes y ausencia de pg_cron/pg_net. La conexión hospedada y la migración alojada no se probaron.
- `npm run verify`: **621/621 PASS**, cero fallos/omisiones; incluye skills, typecheck, suite, builds Node/Vercel y smoke de ambas APIs compiladas. `node scripts/secret-scan.mjs`: PASS después de acortar un valor sentinel de fixture que generó un falso positivo; `git diff --check`: PASS.
- En el head remoto #274 `8892d2b...`, las anotaciones oficiales para `validate`, `postgres` y `public-browser-smoke` informan que los jobs no iniciaron porque la cuenta está bloqueada por facturación. CodeQL también falló al inicio; Vercel Security Review pasó; Supabase Preview quedó SKIPPED. Los heads actuales de #272 y #273 muestran la misma causa de billing en sus anotaciones de validate/postgres. No se lanzaron reintentos ni se modificó facturación. Todo este incremento local continúa pendiente de CI del SHA final.
- Operaciones: cero SQL alojado, conexión a Supabase, dispatch, claim alojado, wake, Cron, envío, gasto, merge o deploy. Coste externo nuevo: no observado; coste futuro de ejecución alojada no comprobado.
- **Rollback:** revertir únicamente los commits nuevos de esta rama PR #274; conservar #272/#273, el ledger original y el worktree P2 sin modificación. Para cualquier ejecución alojada futura se requiere revisión de código/CI utilizable, verificación de proyecto/identidad/TLS/grants, cuota/costo y autorización puntual de migración/configuración/ensayo; esta PR no da ese permiso.

Costo: herramientas locales gratuitas en sandbox, sin proveedor de modelos, despliegue nuevo, servicios contratados ni consumo cloud externo solicitado. No se promete costo cero para una activación futura. El Preview anterior corresponde al head anterior de #274 y no verifica este nuevo candidato.


## 2026-11-22 11:14:54 UTC — Vercel finding #6: fail-closed en grants nulos

Vercel Security Review identificó una autorización Director que fallaba abierta por semántica SQL de tres valores. La regresión se reprodujo en PostgreSQL18 descartable, con SCRAM/TLS verify-full y rol runner: antes del fix, el claim para fixture sin director_authorization devolvió la tarea y consumió un intento. No hubo conexión alojada.

En d9bf79d, el validador retorna booleano no nulo; claim/lecturas/escrituras rechazan resultados que no sean TRUE; se validan argumentos esenciales y flags no_send/no_dispatch del grant. Los negativos cubren autorización ausente, JSON null, active null, grant null, campo grant ausente uno por uno, parámetros RPC null, lecturas no autorizadas y checkpoint/fail/complete tras quitar autorización a un lease. Sin mutación de intento/lease/token/checkpoint/auditoría ante rechazo. PostgreSQL desechable 1/1; npm verify 621/621; secret scan y diff-check PASS.

En el SHA exacto d9bf79d, Vercel Security Review SUCCESS (“No findings”) y Vercel cerró el finding 6 como resolved. GitHub validate/postgres/CodeQL/browser no iniciaron por bloqueo de facturación, según las ocho anotaciones exactas; Supabase Preview SKIPPED. PR #274 sigue abierta/draft. No hubo SQL alojado, conexión, misión/claim remoto, dispatch, wake, Cron, merge, deploy ni gasto. La revisión pendiente de GitHub y los límites alojados se mantienen.