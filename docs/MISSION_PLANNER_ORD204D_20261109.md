# ORD-204D · Derivar y adaptar planes de objetivos autorizados

Fecha: 09/11/2026. Base contrastada: PR #209, borrador, rama `codex/mission-runner-20261109`, SHA `a6cdc0c1eecc13dde9b57a1c69c56c563fbbd33d`; validate/postgres aprobados en ese SHA. Trabajo aislado: `codex/mission-planner-20261109`, `C:/autopilot-worktrees/mission-planner-20261109`. Sin PR equivalente al recuperar estado. La entrega se apila sobre #209: conserva sus cinco commits y los de ORD-204B; no los fusiona, reconstruye ni duplica.

## Objetivo recibido, sin pasos

La fixture entrega esta autorización en `agent_tasks.input.objective`, con `mission_schema_version: "1"` y `goal_version: 1`. No entrega `plan`, `plan_version`, tareas correctivas ni una secuencia de acciones.

```json
{
  "version": 1,
  "kind": "synthetic.ensure_verified_artifact",
  "expected": "canonical_synthetic_result",
  "restrictions": ["local_synthetic_only", "no_network", "no_send"],
  "resources": ["synthetic_worktree", "result_artifact", "verification_fixture"],
  "acceptance": ["artifact_matches", "synthetic_test_passed"],
  "limits": { "maxReplans": 1, "maxSteps": 8 }
}
```

El objetivo canónico de la fila sigue siendo `Verify synthetic mission recovery`. Los recursos son alias de las rutas fijas ya controladas por SyntheticMissionExecutor; no aceptan paths, comandos o contenido ejecutable del solicitante. `canonical_synthetic_result` corresponde a las constantes de resultado y prueba del ejecutor. Configuración del host determina repo semilla, raíz, SHA y permiso `synthetic_worktree`.

## Mecanismo conectado

- [missionPlanner.ts](../src/autopilot/missionPlanner.ts): contrato sustituible `MissionPlanner`, planificador determinista y política independiente. El planificador observa prerrequisitos presentes/ausentes y propone pasos; la política comprueba objetivo original, recursos/restricciones, acciones, grafo, orden, trabajo completado, evidencia y presupuestos. No confía en los permisos de una propuesta.
- [missionRuntime.ts](../src/autopilot/missionRuntime.ts): extiende `createMissionLedger` y `PersistentMissionOrchestrator`, reutilizando los contratos de #209. Guarda el plan antes de actuar. Ante un fallo, observa nuevamente los archivos; solo una ausencia recuperable puede producir una revisión. Los conflictos terminan blocked. El contexto del planificador y ejecutor son copias, sin cliente ni fencing token.
- [syntheticMissionExecutor.ts](../src/autopilot/syntheticMissionExecutor.ts): mismo ejecutor y controles previos, con observación y acciones permitidas en planes versionados. La ruta legacy sigue exigiendo su plan fijo exacto. Se conservan repo semilla, verificación Git/worktree/SHA, hooks desactivados, rechazo de enlaces, dos archivos conocidos, prueba Node fija y entorno reducido. Antes de escribir valida todos los archivos; también comprueba tamaños antes de leer su contenido.
- [six_agent_mission_planning_20261109.sql](../supabase/staged/six_agent_mission_planning_20261109.sql): RPCs opt-in `six_agent_save_plan` y `six_agent_block_mission`, sobre `agent_tasks` y `agent_audit_events`. Plan, versión, observación, motivo, evidencia y auditoría se confirman en una transacción. CAS de checkpoint, token y lease vigentes; replay idéntico no agrega eventos. Recursos originales y completed steps no se amplían ni desaparecen. La revisión original debe coincidir con la autorización actual. Sin otra cola ni scheduler.

Cada revisión conserva el objetivo completo, pasos y dependencias, motivo (`initial_state` / `artifacts_missing`), estado observado y SHA-256 del estado normalizado. El input durable contiene `plan_history` y la versión activa; el checkpoint incluye `plan_version`. IDs de acciones pendientes llevan sufijo de versión; las acciones completadas mantienen su identidad y dependencias. El RPC de checkpoint rechaza una versión de plan diferente de la activa.

## Ejecución observada en PostgreSQL 18 local

La fixture solo construye estados iniciales y aplica fallos. Autopilot elige todos los pasos, la reparación y la continuación. No hay intervención de Codex entre pasos.

| Estado inicial | Plan v1 derivado | Adaptación | Resultado |
| --- | --- | --- | --- |
| Sin worktree | preparar → modificar → verificar | No necesaria | completed; checkpoint 5; intento 1; 6 eventos |
| Worktree vacío | modificar → verificar | No necesaria | completed; checkpoint 4; intento 1; 5 eventos |
| Worktree y archivos válidos | verificar | Prueba eliminada después de persistir v1: v2 modifica → verifica | completed; checkpoint 5; intento 2; 7 eventos |

En el tercer escenario, la verificación observa que falta `result.test.cjs`; el planificador deriva `modify-v2 → verify-v2`, preservando recursos/objetivo. El proceso se pausa después del efecto de modify-v2 y antes de su checkpoint. El arnés lo termina realmente por SIGKILL e inyecta vencimiento del lease. Un proceso nuevo recupera el plan v2 desde PostgreSQL, reconcilia los archivos idénticos sin reescribirlos (mtime de ambos conservado), ejecuta la prueba y completa. La fixture no repone la prueba; solo la elimina como fallo.

Auditoría del caso adaptado: claim → plan v1 → plan v2 → claim nuevo → checkpoint modify-v2 → checkpoint verify-v2 → complete. Los cinco RPCs de escritura (plan/checkpoint/complete/fail/block) rechazan el token anterior vencido y después del takeover. La prueba confirma también el rechazo de checkpoint con plan_version viejo y el replay de plan sin incrementar versión/eventos.

## Negativos y revisión crítica

| Caso | Estado final y motivo | Efecto comprobado |
| --- | --- | --- |
| Objetivo no admitido | blocked / objective_not_admitted | Archivos iniciales intactos |
| Plan cíclico/inválido | blocked / invalid_plan | Ningún paso ejecutado |
| Ampliación de recursos | blocked / permission_expansion | Ningún recurso nuevo habilitado |
| Acción fuera de allowlist | blocked / action_not_allowed | Acción no ejecutada |
| Conflicto irrecuperable tras plan v1 | blocked / unrecoverable_state | Contenido conflictivo no sobrescrito |
| Ausencia repetida tras consumir una adaptación | blocked / replan_budget_exhausted | Historial de dos planes; ninguna tercera revisión ni nueva reparación |

La revisión crítica adicional reprodujo un fallo del ejecutor anterior: si faltaba el resultado pero el segundo archivo tenía conflicto, se escribía el primero antes de descubrir el conflicto. El nuevo caso falló en rojo; después de validar todos los archivos antes de escribir, el caso pasa y el resultado permanece ausente. El cambio no habilita sobrescrituras ni herramientas adicionales.

También se prueban: rollback de plan/estado al fallar la auditoría; dos replays concurrentes con una sola versión/evento; versión CAS obsoleta; permisos SQL denegados a anon/authenticated; presupuesto original inmutable; timeout de un planificador que no responde. Fencing rechazado o una respuesta de escritura ambigua detiene la invocación sin intentar otra escritura de cierre.

## Validación y reproducción

- `npm run verify`: exit 0, 447/447 pruebas, cero omitidas, tipos, 13 habilidades y ambos builds.
- `node --import tsx --test tests/mission-planner-postgres.test.ts`: 13/13 comprobaciones, incluidas tres ejecuciones con planes diferentes y seis negativos terminales.
- Regresión multiproceso ORD-204C: 3/3. La CI conserva además todos los jobs PostgreSQL anteriores y agrega la prueba nueva al mismo job existente.
- Secret scan y revisión del diff; checks `validate` y `postgres` del SHA final se consignan en la PR, sin atribuir checks de #209 al nuevo commit.

La prueba requiere una base nueva loopback llamada `victoriosa_mission_planner_test`, en `PLANNER_TEST_DATABASE_URL`, sin parámetros extra de conexión; rechaza otro destino. Usa transporte psql de prueba para invocar los mismos RPCs, sin fallback alojado. Conserva filas, auditoría y worktrees sintéticos para inspección hasta descartar el entorno. No borra esquemas de bases existentes. Evidencia local: `C:/autopilot-worktrees/mission-planner-20261109-db.log`, `mission-planner-20261109-red.log` y `mission-planner-20261109-verify.log` en el mismo directorio padre.

## Transferencia y límites

**Transferido y ejecutado:** construir un plan de prerrequisitos para un objetivo admitido, validarlo, observar un fallo recuperable, adaptar el plan dentro de permisos/presupuesto y continuar tras pérdida de proceso conservando versión/efectos. Es planificación determinista de este dominio sintético, no planificación general.

Codex todavía define el dominio, contratos, política, acciones y pruebas; prepara/inicia el arnés y revisa la entrega. El arnés inyecta fallos, SIGKILL y vencimiento del lease; no se demuestra scheduler ni servicio permanente. No se activaron modelos ni un proveedor alternativo. La siguiente dependencia a reducir es el arranque y supervisión de misiones autorizadas sin un arnés de prueba, con un límite de aislamiento suficiente antes de admitir código o dominios adicionales.

Se mantienen 45 s de plazo por invocación, subprocesos Git de 15 s y prueba de 10 s, máximo dos replanificaciones configurables (esta demostración autoriza una), máximo ocho pasos y límite de intentos de la cola. El transporte psql tiene timeout de 15 s; otros transportes deben configurar el suyo. Cancelación interrumpe el host y permite recuperación por lease, sin afirmar reversión atómica de filesystem/SQL.

Aislamiento lógico por worktree/allowlist: no es sandbox OS para adaptadores hostiles o código arbitrario. El service_role es del host; los IDs de planner/ejecutor son atribución de auditoría, no identidad criptográfica. SQL permanece staged y solo fue aplicado a PostgreSQL desechable. Sin merge, producción, SQL alojado, credenciales nuevas, compras, campañas ni envíos. Avance N2 técnico compatible con F1→F2→F3→F4; no abre sus puertas operativas. Reversión: revert de este tramo en revisión, conservando #209 y la rama recuperada de ORD-204B.
