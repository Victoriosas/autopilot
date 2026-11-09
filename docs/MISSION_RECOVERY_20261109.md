# Recuperación de misiones: evidencia del 09/11/2026

## Alcance y base recuperada

Orden vigente: desarrollar la transferencia de ejecución de Codex a Autopilot, con prueba sintética y sin efectos externos. Rama `codex/queue-fencing-20261109`, base remota `a6cff5aba04e752cb010926b88c24fd4abfe84b6`. Este avance N2 protege la cola técnica reutilizable para comprobaciones F1; no abre F2, F3 ni F4 ni activa comercio histórico.

El commit referido como ORD-204B, `1b588f71f3194845f7f5a5e9287d436140a88464`, no existe en los objetos locales disponibles después de `git fetch origin`. Su descarga directa devuelve `upload-pack: not our ref`. La búsqueda en refs locales/remotas y en `src`, `tools`, `docs`, `scripts`, `tests` y `supabase` no encontró `MissionLedger`, `MissionOrchestrator`, `six_agent_checkpoint` ni ORD-204. Esto no demuestra que no existan en otro equipo, repositorio o respaldo. La PR #204 es la integración F1 de API y autenticación; no corresponde a esa orden histórica. No se reconstruyó el commit ausente.

Sí existen `agent_tasks`, `agent_audit_events`, `six_agent_claim`, `six_agent_complete`, `six_agent_fail` y el adaptador `src/autopilot/sixAgentPersistence.ts`. `TaskOrchestrator` mantiene su estado en memoria; no acredita un ledger durable de misiones. Las funciones de cola están en SQL opt-in de `supabase/staged`; modificarlo aquí no aplica cambios en Supabase alojado.

## Defecto demostrado y corrección

Antes del cambio, `six_agent_fail` aceptaba el token original de una tarea cuyo lease ya había expirado, antes de cualquier takeover. La regresión ejecutada contra PostgreSQL 18 local obtuvo `t` donde exigía `f`. Ahora tanto completar como fallar exigen `lease_until > clock_timestamp()`. Se usa tiempo real porque `now()` queda fijado al comienzo de la transacción y puede aceptar un lease vencido durante ella.

`tests/six-agent-recovery.test.mjs` ejecuta procesos reales y solo acepta una base loopback llamada `victoriosa_six_agent_test`. Un proceso hijo reclama una tarea sintética, confirma el commit y espera. La prueba lo termina con SIGKILL, comprueba que el lease vivo impide reclamar, fuerza su vencimiento en la fixture y recupera la misma tarea desde otra conexión/proceso psql. Verifica token nuevo, rechazo del anterior, cierre único y auditoría exacta: claim, claim, complete. También comprueba expiración dentro de una transacción y conserva fallo válido/backoff. La expiración es inyectada, no una espera real del scheduler. No hay ejecución de herramientas arbitrarias ni modificación de código por Autopilot.

Reproducción en base desechable ya inicializada con `scripts/test-six-agent-queue.sh`:

```powershell
node --test tests/six-agent-recovery.test.mjs
```

La variable `AUTOPILOT_TEST_DATABASE_URL` debe apuntar a esa base local. La CI existente `Autopilot Core v4 / postgres` ejecuta ahora esa misma prueba después del smoke de la cola. La prueba elimina únicamente sus filas sintéticas por UUID al terminar; inspecciona y afirma la auditoría antes de limpiarlas.

## Qué demuestra y qué falta

| Criterio de la misión solicitada | Estado de este avance |
| --- | --- |
| Recibir objetivo y criterios como misión | Pendiente del ledger/orquestador ausente |
| Crear o seleccionar worktree por Autopilot | No probado; Codex aisló este desarrollo |
| Modificación sintética permitida | No probado por Autopilot |
| Ejecutar prueba y registrar resultado | Ejecutado por el arnés de pruebas; no por un runner de misiones |
| Checkpoint durable de pasos y operaciones | No disponible; solo fila durable de tarea |
| Interrupción real del ejecutor | Probado en proceso sintético después de reclamar |
| Recuperación en otro proceso | Probado para la tarea SQL, no para una misión multipaso |
| Reconciliar efectos para evitar duplicados | Cierre SQL único probado; reconciliación de archivos pendiente |
| Rechazar lease/token obsoleto | Probado antes/después del takeover y dentro de transacción |
| Completar misión y auditoría | Auditoría de tarea probada; misión completa pendiente |

Codex sigue preparando escenario, objetivo y código, lanzando pruebas y revisando evidencia. Esta prueba demuestra recuperación/fencing de una cola acotada; no planificación general, independencia operativa ni ejecución permanente. No se agregó otro scheduler, cola, proveedor o runtime.

## Siguiente orden y límites

Recuperar la ubicación/repo/respaldo de ORD-204B y conservar sus commits; contrastar sus contratos con las funciones existentes antes de conectar el equivalente vigente de ORD-204C. Aceptación: ledger + orquestador + adaptador sustituible deben dirigir modificación/prueba/checkpoint y recuperación tras caída, reconciliando efectos en worktree aislado. Después, evaluar planificación/adaptación del objetivo mediante mecanismo autorizado en una prueba separada.

Sin merge, promoción a producción, SQL remoto, inferencia, envíos, campañas ni gastos autorizados por este avance. El código SQL solo está preparado/probado localmente; producción no recibió esta corrección. Los resultados de `npm run verify` y checks del SHA publicado se registran en la PR y en el checkpoint de continuidad.
