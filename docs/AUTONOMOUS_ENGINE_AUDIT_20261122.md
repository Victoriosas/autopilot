# ORD-AUTONOMOUS-ENGINE-01 — reconciliación y auditoría de seguridad

**Corte:** 2026-11-22 04:50 UTC / 01:50 America/Montevideo
**Base:** `origin/main` `82b6fb24e76d81e5026c94af2630358d00f2ebe9` (#270).
**Rama aislada:** `codex/ord-autonomous-engine-20261122`, inicialmente en esa base.
**Alcance de esta evidencia:** GitHub, fuente versionada y lecturas SQL/metadatos de Supabase. No hubo SQL alojado de escritura, inserción de tareas, claim, envío, cambio de plan, cron, despliegue ni ejecución director.

## Resultado resumido

La infraestructura alojada demuestra **un worker periódico de salud pública**, no un motor autónomo de `director`. Las únicas tareas persistidas en `agent_tasks` son de `infrastructure`: 49 `completed`, 11 `queued` y 6 `blocked`; hay cero tareas `director`. En la ventana consultada hay cuatro `six_agent_claim` y cuatro `six_agent_complete`; los logs corresponden a `six-agent-health-worker`. No se encontró cron de agentes ni invocación del worker de métricas en esa ventana. No hay ejecución autónoma de `director` demostrada.

Se preparó una migración versionada para dos defectos concretos previos al futuro worker: `six_agent_fail` aceptaba el token aún almacenado aunque su lease ya hubiera expirado, y las tablas del ledger otorgaban ACL directas a `anon`/`authenticated` pese a tener RLS sin políticas. La regresión RED se reprodujo contra la migración base; la corrección GREEN pasó en PostgreSQL aislado. La migración **no** se aplicó al proyecto alojado.

## Estado GitHub, trabajos y seguridad concurrente

- `origin/main` fue actualizado por fetch y verificado en `82b6fb24e76d81e5026c94af2630358d00f2ebe9`. El checkout de esta orden es el worktree aislado arriba; el checkout `C:\autopilot` y otros worktrees sucios se dejaron intactos.
- PR #269 sigue abierta sobre el mismo base, head `aac6c4151c24a8b2427010806dab48778ffb8a1b`, sin revisión humana. `validate`, `postgres`, CodeQL y `public-browser-smoke` figuran fallidos con cero pasos ejecutados; GitHub no devolvió logs para los trabajos consultados. No se atribuye una causa no visible ni se cuentan como pruebas fallidas de código. Vercel Preview/Security Review figuran exitosos; Supabase Preview está `SKIPPED`.
- El comentario de revisión Vercel en #269 registra un hallazgo `security-control-bypass`: la demo de consultas depende de una regex de ruta sin normalizar, y pide que el modo staging sea estructuralmente incapaz de llamar a Resend o Supabase de producción. Un comentario posterior del propietario informó reproducción local de variantes de ruta y cero envíos observados; eso no cierra el hallazgo estructural. #269 no fue modificada ni fusionada por esta orden.
- PR #271 es independiente y no se modificó. El workflow periódico de disponibilidad tuvo su última ejecución exitosa listada en run `44941101623`, SHA `0df5d16da834844535921f887f1745629e5d0ecb`; acredita ese chequeo de salud, no al worker `director` ni al SHA actual. El último run del workflow Core consultado para el SHA main `82b6fb2` terminó con cero pasos y sin logs; su causa queda no clasificada.
- La inspección de procesos no encontró escritor de esta rama ni proceso escuchando en el antiguo puerto de trabajo. El PostgreSQL de laboratorio usado por este ciclo se identificó por su ruta temporal y puerto exclusivos; se detendrá al cerrar las verificaciones locales.

## Estado alojado verificado en modo solo lectura

Proyecto principal `jfjzpwlrhzqbcrvqxhzf`: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.166; organización en plan Free. Solo aparece la rama Supabase `main`. Los metadatos de migración contienen las dos migraciones desplegadas de seis agentes (`20261025045757` y `20261025060425`); **no** contienen el checkpoint/misión staged `20261109` ni esta corrección. `six_agent_claim_mission` no existe en el proyecto alojado.

Extensiones: `pg_cron` instalado; `pg_net` disponible pero no instalado; `pgmq` disponible pero no instalado. El único cron activo es `consultation-retention-hourly` (`0 * * * *`). No hay cron de agentes.

Tablas `agent_tasks` y `agent_audit_events`: RLS habilitado, `FORCE ROW LEVEL SECURITY` falso, cero políticas. La lectura de ACL confirma privilegios de tabla directos para `anon` y `authenticated` en ambas tablas, además de `service_role`. Con cero políticas las peticiones de `anon`/`authenticated` quedan actualmente bajo denegación por RLS; los grants siguen siendo una concesión latente si aparecen políticas o cambia el acceso. Los RPC de claim/complete/fail consultados solo conceden `EXECUTE` a `service_role`, no a `anon` ni `authenticated`.

Funciones desplegadas, todas activas y con `verify_jwt=false`:

| Función | Versión | Autenticación/alcance observado | Límite de auditoría |
|---|---:|---|---|
| `six-agent-health-worker` | 5 | Verifica JWT de GitHub OIDC con firma/JWKS, issuer, audience, repo e ID, `refs/heads/main`, `workflow_ref` exacto y evento permitido. Solo POST; usa service key del entorno de servidor, crea el identificador determinista del slot, reclama el claim especializado de infraestructura y consulta una URL pública fija. No procesa payload arbitrario ni envía a clientas. El fuente desplegado coincide con `main` tras normalizar saltos de línea. | No valida `Origin` explícitamente; el acceso se basa en OIDC, no en `Origin`. La función no es un worker `director`. |
| `six-agent-report-metrics` | 5 | Verifica OIDC con restricciones equivalentes y es GET de lectura; devuelve conteos agregados y no devuelve `input` ni el texto de evidencia. El service key permanece en entorno de servidor. El fuente desplegado coincide con `main` tras normalizar saltos de línea. | Lee hasta 1.000 filas y falla si el resultado llega a ese límite. La consulta selecciona `completed_evidence` completo aunque solo lo usa para contar presencia; conviene reducir esa lectura en un cambio posterior de minimización. No es claim ni ejecución de tarea. |
| `autopilot-api` | 14 | `verify_jwt=false`; el bundle inspeccionado contiene rutas con `auth.getUser`, `requireControlPlaneAuth` y secretos cargados del entorno de servidor. No contiene `six_agent_claim_mission` ni `missionRuntime`. | El bundle incrusta commit `a1b5ec996fd33afeb18b6dd6b1b118a3a1d23958`, ausente del grafo Git actual; por ello no se pudo auditar línea por línea la versión desplegada frente a una fuente verificable. No se certifica la autenticación de todas sus rutas a partir de fragmentos. |

`Origin` no constituye autenticación. Ninguna de las dos funciones OIDC valida explícitamente el encabezado `Origin` ni aplica una política CORS de allowlist; para ambos workers la identidad GitHub validada es la barrera efectiva observada. La ausencia debe permanecer documentada, pero no se propone usar CORS/Origin como reemplazo de autenticación. No se leyó ni imprimió valor de secretos.

## Contratos de claim, finalización y límites funcionales

- `six_agent_claim` es `SECURITY DEFINER`, usa `search_path` vacío, exige `service_role`, limita `agent_id` a seis nombres y el lease a 5–300 segundos, reclama con `FOR UPDATE SKIP LOCKED` y rota `execution_token`. `consultations` está pausado. Sin embargo, el RPC genérico no restringe `action`, `actor` o `input` por agente y devuelve el payload de la tarea. No debe conectarse un worker `director` genérico a este contrato sin un claim específico y allowlist de misión.
- `six_agent_claim_public_health` restringe a la tarea fija de salud de `infrastructure`. El flujo observado de claim usa locking y token por intento; el contador y los audit events se actualizan en SQL.
- `six_agent_complete` exige `service_role`, evidencia acotada, token correcto, estado `running` y lease vigente. La función alojada verifica vencimiento.
- `six_agent_fail` alojado exige `service_role`, token y estado `running`, pero **no** comprueba que `lease_until` siga vigente. Entre vencimiento y re-claim, el token antiguo aún almacenado puede cambiar el estado y registrar fallo. La migración preparada agrega la comprobación de lease al `UPDATE`.
- La migración staged `six_agent_mission_checkpoint_20261109.sql` contiene más primitivas de checkpoint/claim, pero no está desplegada; el worker autónomo director, verificación independiente del resultado, política de cancelación/revocación, captura terminal y flujo de panel manual no están implementados como circuito alojado comprobado.
- El endpoint admin existente es una lectura autenticada de conteos/última actividad desde Supabase; no acredita heartbeat del worker ni ofrece un circuito director de admisión, verificación independiente y cancelación. Un estado `ready`/configurado no demuestra ejecución.
- El health worker y el reporte de métricas no realizan envíos, compras ni cambios de código. No se demostró que un worker `director` respete `no_send`, porque tal worker no existe. La vulnerabilidad abierta de #269 debe seguir en cuarentena, sin afirmar que se corrigió aquí.

## Cambio preparado y validación sintética

Archivos de código de esta propuesta:

- `supabase/migrations/20261122045000_six_agent_fail_lease_fencing.sql`: revoca ACL de `PUBLIC`, `anon` y `authenticated` sobre las tablas del ledger; reemplaza `six_agent_fail` con la misma interfaz y valida `lease_until > clock_timestamp()`; vuelve a dejar `EXECUTE` solo en `service_role`.
- La misma migración agrega `six_agent_report_metrics()`: RPC `SECURITY DEFINER` de solo lectura que comprueba `service_role` y devuelve seis filas agregadas; Postgres computa `completed_with_evidence` sin transferir el texto `completed_evidence` al worker. El RPC niega `EXECUTE` a `PUBLIC`, `anon` y `authenticated`.
- `supabase/functions/six-agent-report-metrics/index.ts` llama ese RPC y valida el conjunto exacto de seis agentes, cada contador como entero seguro no negativo, y el resultado agregado; deja de leer `agent_tasks.completed_evidence` desde Edge.
- `scripts/test-six-agent-queue.sh`: crea deliberadamente un sobregrant a roles de navegador, comprueba que todos los privilegios de tabla (incluido `MAINTAIN`) y el permiso de ejecutar el RPC queden revocados, confirma el conteo privado con una evidencia sintética centinela que no aparece en la salida, y prueba que un token cuyo lease expiró no cambie tarea, token ni auditoría. Conserva las regresiones ya existentes de claim, token, idempotencia/concurrencia y checkpoint staged.
- `scripts/six-agent-edge-security.test.mjs`: prueba el uso del RPC, la ausencia del campo de evidencia crudo, el rechazo de conteos/filas incompletos y la autenticación OIDC existente.

**RED:** sobre el SQL base alojado (copiado a DB desechable, sin la nueva migración), `six_agent_fail` devolvió `true` para el token actual con lease ya vencido (`RED expired lease fail accepted=true`).
**GREEN SQL:** aplicando la migración en DB PostgreSQL 18 aislada `metrics_rpc_regression_20261122`, el script completo terminó exit code 0: `six-agent atomic queue and restricted health claim smoke tests passed`; el RPC devolvió conteos correctos y ningún texto centinela, browser roles no obtuvieron `EXECUTE`, y el caso de lease vencida dejó intacto estado/token/auditoría. Ningún test se conectó a Supabase alojado.

**RED/GREEN Edge:** la expectativa de llamar RPC y no seleccionar `completed_evidence` falló antes de editar el handler; pasó luego con `node --test scripts/six-agent-edge-security.test.mjs` (5/5). Tras este incremento, `npm run verify` terminó exit 0: 614/614, cero fallos/omitidas, typecheck, Node/Vercel builds y API smoke. El PostgreSQL de laboratorio se detuvo luego de confirmar ausencia de sesiones cliente; el puerto 55557 quedó sin respuesta. El commit/PR inicial anterior no contiene este segundo incremento todavía.

`npm run verify` sobre la rama después del cambio: exit 0; 14 skills, TypeScript, suite completa 614/614 (0 fallos, 0 omitidas), build Node, build Vercel y comprobación de APIs compiladas. Avisos Vite existentes de `configLoader` no fallaron la compilación. `npm run verify` no sustituye la regresión PostgreSQL anterior. Al cierre, la instancia desechable de PostgreSQL fue detenida tras confirmar que no tenía sesiones cliente; `pg_isready` devolvió “no response” en el puerto aislado 55557. Su directorio temporal se conserva, sin otros datos del repositorio alterados.

## Cuotas, costo y diseño de disparador

La cuenta figura en plan Free. La documentación actual de Supabase incluye 500.000 invocaciones Edge/mes y fija 150 s de duración wall-clock, 2 s CPU y 256 MB para Edge Functions Free; Cron recomienda no más de ocho trabajos concurrentes y menos de diez minutos por trabajo. Estas cuotas no son una medición de uso/costo de esta tarea ni garantizan capacidad suficiente de Postgres. `pg_net` falta instalado. Supabase recomienda Vault para invocar Edge Functions desde Cron, pero documenta que la clave descifrada queda temporalmente en la cola de `pg_net` y puede ser leída por un rol con login a la base; la autenticación futura debe mitigar y documentar ese límite. Referencias oficiales: [límites Edge](https://supabase.com/docs/guides/functions/limits), [tarifa Edge](https://supabase.com/docs/guides/functions/pricing), [Cron](https://supabase.com/docs/guides/cron), [programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).

No se instaló extensión, no se creó cron y no se desplegó una función. El presupuesto real de una ejecución alojada y el uso mensual disponible no se midieron; no se atribuye coste cero. El worker de salud existente programado por GitHub Actions no se reutilizó como worker `director`. Las Actions de PR son CI de código, no el disparador de una tarea real.

## Bloqueos y aceptación pendiente

1. Revisión/CI remota de esta única PR en su SHA final; un `SKIPPED` no cuenta como aprobado. Si GitHub no inicia trabajos o no entrega logs, registrar el bloqueo sin elevar cuota ni cambiar protecciones.
2. Aprobación explícita separada para aplicar la migración a Supabase alojado, instalar `pg_net` si el diseño final lo necesita y desplegar la función/configurar el cron. Esta orden prohíbe esos efectos.
3. Antes del primer `director` alojado: concretar una misión read-only y su identidad/idempotency key; claim restringido a acción/actor/entrada exactos; verificador independiente que recompute la evidencia; `complete` inaccesible sin ese verificador; expiración/fencing y revocación negativas; autenticación del cron sin exponer tokens en tabla/logs; compatibilidad con el gasto/cuotas medidos; panel admin sin afirmar ejecución a partir de configuración.
4. Las puertas de producto F0–F4 siguen prevaleciendo para cualquier autonomía futura; esta preparación técnica no activa P3/F5. PR #269 conserva además el hallazgo `no_send` abierto mencionado arriba.

**Criterio de ejecución real:** una fila concreta de `director` admitida con autorización vigente, run id y worker independientes de GitHub Actions/Codex, evidencia recomputada de forma independiente y finalización/audit event verificables desde otro proceso. Ninguna parte de ese criterio se da por cumplida en este ciclo.
