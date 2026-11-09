# ORD-204C · Ejecución y recuperación sintética

## Recuperación y alcance

El 09/11/2026 se accedió al Codespace indicado por el propietario desde Chrome, con su sesión existente. Se verificó `/workspaces/autopilot-mission-recovery`, rama `codex/mission-checkpoint-recovery-20261109`, árbol limpio y cuatro commits por delante de su origin/main. Se publicaron conservando sus SHA: `30c40ae7ebfcac5f9268d1d9dbd3158027e7e0cc`, `343d4961a885a68282e7b9b85b6614e316683580`, `b7cafd6` y `1b588f71f3194845f7f5a5e9287d436140a88464`. La autenticación existente permitió el push; no se cambiaron credenciales ni permisos. Queda resuelta la dependencia de acceso descrita previamente en PR #208.

Desarrollo aislado: `C:/autopilot-worktrees/mission-runner-20261109`, rama `codex/mission-runner-20261109`, sobre el commit original completo. No se inició otro agente Copilot/OpenCode. El trabajo F1 y las fases F2→F3→F4 mantienen sus puertas; este avance N2 permite probar recuperación de procedimientos técnicos sin tocar consultas reales. No hay otro scheduler, cola ni servicio activo.

## Componentes ejecutables

- `createMissionLedger`: consume el envelope de `six_agent_claim`, reconstruye objetivo/plan/checkpoint y conserva el claim/token en el host. Reutiliza `saveMissionCheckpoint`, `completePersistedTask` y `failPersistedTask`. Los permisos proceden de configuración del host, no del payload. El SQL entrega el objetivo canónico de la fila, prevaleciendo sobre un campo `input.goal` no confiable.
- `PersistentMissionOrchestrator`: valida el grafo, selecciona el siguiente paso por dependencias, entrega una copia del contexto al adaptador, revisa el resultado, guarda la siguiente versión y cierra. No acepta saltos de varios pasos ni estados finales sin evidencia. Un rechazo de fencing detiene la ejecución sin intentar otro cierre. Admite cancelación y un plazo de ejecución de adaptador de hasta 45 segundos; los procesos Git tienen timeout de 15 segundos y la prueba de 10 segundos. Los transportes de base de datos deben configurar también sus propios timeouts (psql de prueba: 15 segundos). No mantiene un servicio continuo ni renueva leases.
- `SyntheticMissionExecutor`: implementa `ExecutorAdapter`, limitado al objetivo, plan, restricciones y criterios sintéticos exactos. Solo admite un repositorio semilla de un archivo conocido, worktree derivado del ID validado y dos archivos permitidos. Desactiva hooks Git; no ejecuta scripts de la aplicación ni comandos de shell. Comprueba worktree/base/rama/repositorio, enlaces y contenido existente. Reutiliza efectos idénticos, rechaza conflictos y ejecuta una prueba Node fija con entorno reducido.

El aislamiento es lógico y por worktree/allowlist; no es una sandbox de seguridad para código arbitrario o adaptadores hostiles en el mismo proceso. Los adaptadores no reciben credenciales ni token en su contexto. Antes de ejecutar código general harían falta aislamiento de proceso/OS, autenticación del ejecutor y permisos independientes de service_role. El fencing probado protege escrituras SQL; no se afirma atomicidad distribuida entre PostgreSQL y un filesystem arbitrario.

## Prueba real del circuito acotado

`tests/mission-runner-postgres.test.ts` crea el objetivo autorizado en `agent_tasks` de PostgreSQL 18 desechable, con tres pasos: preparar, modificar y verificar. La fixture suministra recursos y registra/interrumpe procesos; los componentes de Autopilot seleccionan y ejecutan los pasos y guardan checkpoints, sin decisiones de Codex entre pasos.

El primer proceso persiste `prepare` (versión 1), escribe los dos archivos y se pausa antes del checkpoint de `modify`. El arnés lo termina con SIGKILL. Se inyecta vencimiento del lease en la fixture, sin esperar al scheduler. Otro proceso y otra instancia/identidad del adaptador recuperan el estado durable, detectan el efecto ya aplicado y no reescriben el archivo (mtime conservado). Ejecutan la prueba, guardan las versiones 2 y 3, y completan la misión en versión 4, intento 2.

Auditoría verificada: `six_agent_claim → mission_checkpoint_saved → six_agent_claim → mission_checkpoint_saved → mission_checkpoint_saved → six_agent_complete`. Se comprueban las identidades `synthetic-first` y `synthetic-replacement`, las versiones y resultados, el cierre único y el rechazo del token viejo para checkpoint/complete/fail antes y después de la recuperación. Prueba adicional: contenido contradictorio se rechaza sin sobrescribir ni ejecutar la fixture alterada.

| Criterio solicitado | Evidencia |
| --- | --- |
| Recibir objetivo autorizado y criterios | Fila sintética consumida por el ledger; objetivo canónico verificado |
| Crear o seleccionar worktree | Ejecutor crea una rama/worktree en repo semilla aislado |
| Modificación permitida | Dos archivos fijos, con contenido comprobado |
| Prueba y resultado | Node test ejecutado por el adaptador; resultado en checkpoint |
| Checkpoint durable | RPC real, versiones 1→4 y auditoría transaccional |
| Interrupción del proceso | SIGKILL tras efecto y antes del siguiente checkpoint |
| Recuperación en otro proceso | Nuevo proceso/instancia reclama y continúa desde versión 1 |
| Reconciliar efectos | Contenido idéntico reutilizado, mtime conservado; conflicto rechazado |
| Lease/fencing obsoleto | Tres escrituras viejas rechazadas; regreso posterior también rechazado |
| Completar y auditar | Estado completed, dos intentos, tres resultados passed y seis eventos |

## Reproducción, verificación y límites

La prueba exige una base nueva en loopback llamada `victoriosa_mission_runner_test`, accesible mediante `MISSION_TEST_DATABASE_URL`; aborta con otra ruta/host o parámetros de conexión adicionales. No borra esquemas existentes. Ejecutar `node --import tsx --test tests/mission-runner-postgres.test.ts`. Conserva la fixture y auditoría en el entorno desechable para inspección. La CI existente crea esa base y ejecuta esta prueba, más el smoke histórico y la regresión de proceso/lease de #208.

Validación local: misión/reconciliación y dos negativos 3/3; ocho pruebas de contratos, permisos, grafo, cierre, rechazo de checkpoint, fallo, apagado y timeout; smoke SQL histórico con concurrencia, replay y rollback de auditoría. La suite general y CI del SHA final se informan en la PR y el checkpoint. No confundir CI PostgreSQL con Supabase alojado; SQL sigue en `supabase/staged`.

**Transferencia demostrada:** un procedimiento técnico fijo puede crear su entorno, aplicar un cambio, probar, conservar estado y recuperarse con evidencia. Codex todavía escribe/autoriza el escenario y el código, inicia los procesos de prueba y revisa el resultado. La sustitución probada es entre instancias/identidades del mismo adaptador; no entre proveedores/modelos distintos.

**No demostrado:** derivar o adaptar planes generales desde objetivos, modificar una aplicación real, continuidad desatendida, runtime cloud, inferencia, entrega a personas o integración alojada. El plan sintético lo entrega la fixture; no lo genera el sistema. La siguiente orden debe agregar un mecanismo de planificación autorizado con una prueba separada de derivación y adaptación ante un fallo, manteniendo herramientas permitidas y revisión humana donde corresponda. No activar un modelo remoto por inercia.

**Release:** rama/PR revisable, sin auto-merge ni promoción a producción. Reversión mediante revert de los commits revisados; no hubo SQL alojado, campañas, envíos, pagos, DNS ni cambios de secretos. El código y la base de ORD-204B permanecen preservados en su rama remota.
