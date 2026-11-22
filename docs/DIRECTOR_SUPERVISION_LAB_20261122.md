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
5. Tras vencer realmente la lease (5 segundos solo en este transporte de prueba), el token anterior no puede llamar a fail ni guardar checkpoint.
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

La prueba SQL explícita falla si faltan prerrequisitos; no se cuenta como aprobada u omitida dentro de `npm run verify`, que sigue siendo la validación de aplicación independiente. En este incremento `npm run verify` aprobó tipos, builds Node/Vercel y smoke de API compilada: 619 tests, 618 aprobados, cero fallos y una omisión existente exclusiva de Windows. Escaneo de secretos y diff-check aprobados. CI remota del nuevo SHA debe consultarse aparte; no heredar los resultados de su padre.

## Diseño del adaptador persistente seguro
No hace falta sustituir `CloudMissionStore` ni `createMissionLedger`:
- **Lectura técnica:** `CloudMissionStore.status()` sobre el ledger aislado existente, usando binding, identidad fijada, libpq y TLS verify-full. Este transporte requiere un host con psql; no asumir que Vercel Functions o Supabase Deno pueden ejecutar ese binario.
- **Checkpoint/claim/completion:** las RPC existentes a través de `createMissionLedger` conservan tokens en el host y fuera del ejecutor. La proyección de estados no concede autoridad para invocarlas.
- **Claim Director pendiente:** `CloudMissionStore` hereda un cliente de laboratorio cuyo selector está restringido a `software`; no es hoy un canal Director. Se requiere revisar un claim acotado a la misión/slot Director, sin ampliar el selector genérico a tareas ajenas ni retirar el binding. El ensayo usa exclusivamente las RPC existentes en una base propia y no cambia esa restricción cloud.
- **Puerta de autorización pendiente:** el runtime protegido `authorizedPermanentMissionRuntime` es deliberadamente local y rechaza otro tipo de store. No cambiar esa comprobación para hacer pasar la demo. El futuro host cloud necesita un transporte revisado de autorización durable/effect gating y verificador independiente antes de conectarlo a claims reales.
- **Identidad y aislamiento:** cotejar el marcador/binding de laboratorio, recursos, actor, misión, SHA revisado y versiones antes del claim. Rol SQL mínimo, sin superusuario/BYPASSRLS ni grants navegador; una credencial admin no prueba mínimo permiso.
- **Seguridad de resultado:** lectura acotada, agregados sin PII; no transferir evidencia cruda al cliente. Ejecutor sin claves, sin cliente SQL/RPC y sin selección arbitraria de herramientas. Solo observación/checkpoint autorizados, cuotas deterministas y kill switch.

## Preparación de 30 minutos: sin activar
Se conserva el SQL comentado de #273, sin nuevo Cron, archivo de schedule ni workflow. Frecuencia propuesta: `*/30 * * * *`; almacenamiento en UTC y presentación `America/Montevideo`. Reconciliar primero los jobs existentes, incluido cualquier heartbeat local, para no crear dos dueños de una misma misión.

Diseño de idempotencia pendiente de implementar/revisar antes de activar: identidad por slot UTC de 30 minutos en el mismo ledger (`synthetic-director-<epoch-slot>`), admisión única bajo control del host, lease exclusiva por misión y token de fencing en todas las escrituras. Una repetición del trigger debe observar el mismo slot y no abrir otra misión. La prueba demuestra idempotencia de checkpoint y recuperación de una misión, **no** implementa ni certifica todavía la admisión por slot o exclusión global de schedulers.

## Dependencias exactas del primer ciclo alojado
| Puerta | Evidencia necesaria | Estado actual |
|---|---|---|
| Seguridad #272 | Revisión/aprobación e integración autorizada; aplicación separadamente autorizada en lab; definición SQL y negativos de lease/grants consultados de nuevo | Código pendiente; NO aplicada alojada |
| Entorno ledger | Confirmar `juyowvmtluxfetgkckjd`, marcador/binding, tablas, índices, funciones queue/checkpoint y política/grants efectivos, sin datos de principal | No reconsultado aquí |
| Runtime | Host cloud existente con psql/TLS para CloudMissionStore, o transporte RPC revisado compatible; identidad dedicada, permiso durable por efecto y verificador independiente | No conectado por esta prueba |
| Conexión | Credencial exclusiva de lab, CA/verify-full, identidad sin bypass, DNS/ruta accesible desde el host autorizado | No disponible/verificado en esta sesión |
| Credenciales | Responsable introduce valores en el entorno elegido, nunca chat/Git; no copiar credenciales de principal a Preview ni usar service_role como token wake | Pendiente de configuración aislada |
| Wake #273 | Revisión; despliegue aislado autorizado del preflight y pruebas 401/503/200; después integración específica al ciclo, sin equiparar preflight a ejecución | Solo preparación |
| Disparo | Reconciliar jobs; aprobación posterior de un único mecanismo. La ruta Supabase necesita pg_net/Vault y ACL/retención de encabezados revisados; no instalarlos ahora | No activado |
| CI | Checks exactos utilizables/aprobados o causa externa clasificada con anotaciones oficiales; resolver facturación solo por el titular | Fallidos, causa no revalidada aquí |
| Cuotas | Uso/costo de worker, DB, red y límite por ciclo medidos; máximo 1 ciclo concurrente, deadline/reintentos y parada por error/presupuesto | No medidos alojados |
| Admisión | Misión sintética única de observación, `no_send`, `no_dispatch`; revisar slot idempotente, actor/rol y política; nunca reclamar una misión comercial | Solo fixture local |
| Recepción independiente | Un observador distinto consulta attempts/token sustituido/checkpoint/auditoría; induce fallo autorizado, reanuda y comprueba no replay/no envíos | Demostrado solo local |

GitHub puede alojar el worker a través del workflow PLAN Cloud existente, pero no es una salida efectiva mientras sus runners estén bloqueados. Vercel continúa con la UI/API administrativa; no se añade una dependencia del PC ni un bucle serverless. La alternativa Edge de #273 es un preflight y todavía requiere adaptar/revisar el ciclo: no basta instalar pg_net.

## Cambios y rollback
Añadidos: runner local, prueba PostgreSQL, fixture de composición y este informe. `package.json` expone el comando explícito; `AUTOPILOT_STATE.md` registra continuidad. Sin cambio en SQL de #272, handler/cron de #273, controles, UI, migraciones o secretos alojados. Revertir estos archivos elimina la capacidad de demostración; no hay scheduler/servicio cloud que deshacer.

Costo: herramientas locales gratuitas en sandbox, sin proveedor de modelos, despliegue nuevo, servicios contratados ni consumo cloud externo solicitado. No se promete costo cero para una activación futura. El Preview anterior corresponde al head anterior de #274 y no verifica este nuevo candidato.
