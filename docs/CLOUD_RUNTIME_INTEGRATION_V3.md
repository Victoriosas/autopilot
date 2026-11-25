# Cloud runtime V3 · implementación y activación separada

Fecha: 24/11/2026, America/Montevideo. Rama: `autopilot-integration`.
Fase: infraestructura de F1/F4; sin ampliar autonomía clínica, comercial o de envíos.

## Base y reconciliación

| Fuente | SHA integrado | Dependencia |
|---|---|---|
| main | `82b6fb24e76d81e5026c94af2630358d00f2ebe9` | Sin modificaciones ni merge a main |
| PR #272 | `cb67032cd2319b622f5868590e14dc291c1ce001` | Fencing de fail con lease y agregados SQL |
| PR #273 | `009713fc5e444176bf97f8e7ffa3287b4ae849c4` | Preflight conservado; no ejecuta tareas |
| PR #274 | `4d4f2720a2c759c9921ea94d41035dcdbfa1b10e` | Director sintético y pruebas SQL conservados |

Los conflictos fueron de continuidad y scripts de package.json; ambos comandos de
prueba se conservaron. La corrección SQL de #272 pasó sin cambios de contenido a
`supabase/staged/20261122045000_six_agent_fail_lease_fencing.sql`: no está aplicada
en hosted y no debe entrar en descubrimiento automático de migraciones. El test de
inventario vuelve a distinguir SQL desplegado de SQL propuesto.

## Implementación

- `cloudRuntimeV3.ts`: un ciclo acotado del Director, cinco adaptadores y cierre
  persistido; no mantiene proceso, temporizador, cola ni supervisor propios.
- `cloud_runtime_v3_REVIEW_ONLY.sql`: reutiliza `agent_tasks` y
  `agent_audit_events`, con roles separados `autopilot_cloud_runtime` y
  `autopilot_cloud_reader`. Ninguno recibe permisos de tablas ni RPC genéricas.
- Una fila de política reservada `cloud-v3:control` vincula subject de JWT firmado,
  SHA, ventana, no_send, scheduler y constancia del apagado de GitHub. No se crea
  hasta el ensayo aprobado. No aceptar tokens de service_role en esta modalidad.
- Lock transaccional global para un Director, slots UTC de 30 minutos,
  idempotencia, tres intentos máximos y fencing de padre/hijo por generación,
  token y lease. Revocación comprobada en cada RPC. Ninguna tarea bloqueada es
  candidata a claim.
- `/autopilot-director-wake/run` usa un token propio, diferente al preflight.
  Está cerrado por defecto. Necesita owner `supabase_cron`, flag explícito,
  credencial de runner y SHA de artefacto empaquetado igual al SHA aprobado.
- La ruta OIDC de GitHub conserva issuer, audience, repo, workflow, ref y firma.
  El health worker rechaza ejecución tras el relevo mediante owner
  `supabase_cron`; no basta con dejar de programar llamadas.
- Lector admin con transporte y JWT de lectura explícitos, sin fallback a tablas
  productivas o service_role. Proyecta solo conteos, heartbeat, resultado acotado
  y SHA. Mantiene 503 si falta configuración, credencial o SQL; configurado y
  válido devuelve 200. No se afirma haber reparado todavía el 503 desplegado.
- Menú administrativo muestra evidencia persistida, fallos y antigüedad del
  heartbeat. Un resultado es una ejecución puntual, no prueba continuidad 24/7.

| Agente | Ejecutor incluido | Límite explícito |
|---|---|---|
| Director | Claims de cinco hijos y comprobación de sus cierres | No ejecuta tareas arbitrarias |
| Software | Compara SHA compilado en el artefacto con el autorizado | No es un agente de desarrollo ni genera PR por sí mismo |
| Infraestructura | Un GET HTTPS fijo a Victoriosas, sin redirect/retry | DNS/TLS/timeout/HTTP/contenido/red separados |
| Consultas | Cuenta entradas vigentes dentro de Postgres | No clasifica, redacta ni levanta la pausa de atención |
| Seguimiento | Cuenta tareas bloqueadas o pendientes de aprobación | No contacta personas ni modifica sus expedientes |
| Informes | Cuenta eventos persistidos | Sin evidencia cruda, PII ni proveedor IA |

Estos adaptadores son ejecutores de observaciones reales de alcance reducido.
No sustituyen los ejecutores de desarrollo, comprensión clínica o comunicaciones.
El éxito integral solicitado sigue pendiente de prueba cloud y de esos alcances.

## Verificación reproducible

En PowerShell, desde el worktree de integración:

```powershell
npm ci --ignore-scripts
npm run verify
$env:DIRECTOR_LAB_PG_BINDIR='C:/Program Files/PostgreSQL/18/bin'
npm run test:cloud-runtime:db
npm run test:director-supervision:db
$env:DIRECTOR_LAB_SUITE='integration-regressions'
node scripts/test-director-supervision-db.mjs
Remove-Item Env:DIRECTOR_LAB_SUITE
npm run test:hosted-replay:db
node scripts/test-consultation-postgres.mjs
node scripts/test-beauty-postgres.mjs
node scripts/test-beauty-catalog-postgres.mjs
npm run test:commerce:db
node --test scripts/six-agent-edge-security.test.mjs scripts/agent-health-queue.test.mjs scripts/agent-daily-report.test.mjs scripts/infrastructure-health.test.mjs
node --import tsx --test tests/migration-history.test.ts
node scripts/secret-scan.mjs
```

Las pruebas V3 usan PostgreSQL 18 descartable, loopback, SCRAM y una conexión de
rol restringido con TLS verify-full. Incluyen concurrencia, replay, revocación,
NULL, vencimiento y tokens de generaciones anteriores. Resultado observado:
6 cierres, 6 heartbeats y 6 eventos de resultado; 6 bloqueadas sintéticas y sus
eventos anteriores intactos. El health en ese ensayo es fixture, no red externa.
El Director original #274 también pasó su prueba aislada de recuperación.
Supabase hosted observado usa PostgreSQL 17; falta el ensayo equivalente alojado.

Único GET externo controlado: `2026-11-24T23:30:31.943Z` (20:30 Uruguay),
HTTP 200, HTML de Victoriosas, diagnóstico `ok`, una petición, cero escrituras.
Origen: PC local; **no es evidencia de ejecución cloud**. No se repitió.

Evidencia operativa hosted mínima, solo lectura: el principal conserva 6 tareas
bloqueadas, fingerprint agregado `607eb4a9f680ea6826964779f2f74f72`.
El ledger separado `juyowvmtluxfetgkckjd` tiene tasks/audit pero carece de inbox.
No se escribieron filas, autorizaciones, secrets, extensiones ni schedulers.

## Artefactos y Vercel alternativo

Tras commit limpio en `autopilot-integration`:

```powershell
npm run package:cloud-runtime
```

Genera un bundle Deno autocontenido con SHA compilado, digest SHA-256 y manifest
en `output/cloud-runtime-v3/`. El SHA no viene de la petición ni de un env mutable.
La fuente original sin empaquetar falla cerrada al intentar ejecutar el runtime.
El artefacto no despliega ni configura nada remoto.

Vercel: ambos builds y smoke de API forman parte de `npm run verify`.
`vercel.json` prepara esta rama con `deploymentEnabled=false`, sin crons de
sourcing. El despliegue alternativo requerirá solo variables **Preview**:

| Variable | Uso |
|---|---|
| `AUTOPILOT_STATUS_URL` | URL explícita del ledger aislado aprobado |
| `AUTOPILOT_STATUS_API_KEY` | Publishable/anon API key del proyecto aislado |
| `AUTOPILOT_STATUS_READER_JWT` | JWT firmado y con vencimiento del rol lector |

No copiar variables productivas a Preview por defecto. El login admin conserva su
validación vigente; solo usuarios autorizados pueden leer los agregados. No se
habilita un endpoint público de métricas. No se ha creado despliegue alternativo.

## Autorización 1: primer ensayo cloud aislado

Pendiente autorización específica del propietario, conforme a la restricción de
esta misión sobre migraciones. Propuesta concreta:

1. Destino: ledger separado `juyowvmtluxfetgkckjd`, nunca el principal
   `jfjzpwlrhzqbcrvqxhzf`. Comprobar el SHA final y que no hay jobs V3 activos.
2. Aplicar primero el fencing #272 y después `cloud_runtime_v3_REVIEW_ONLY.sql`,
   sin cambiar RLS ni tablas heredadas. Fotografiar conteos/fingerprints antes y
   después. No clonar datos de clientas.
3. Aplicar `cloud_runtime_v3_isolated_fixture_REVIEW_ONLY.sql` solo en ese ledger,
   con su guard de project ref y rechazo de una inbox preexistente. Crea una
   bandeja sintética con RLS y una entrada ficticia sin PII, con vencimiento de
   una hora. El receipt debe identificar que las consultas del ensayo son
   sintéticas. No se copia ninguna inbox ni dato de producción.
4. Provisionar JWT runner/lector de corta duración con roles específicos y
   subject fijo, y grant de esos roles a `authenticator`. Usar la firma ya
   admitida por el proyecto; no rotar claves ni ampliar service_role. Esta
   configuración privilegiada también forma parte de la autorización pendiente.
5. Subir **solo** el bundle de wake al proyecto aislado, con API key pública,
   runner JWT, token cloud propio, SHA aprobado y flag de ejecución explícito.
   La fila control debe expirar en una hora. Scheduler aún ausente/inactivo.
6. Ejecutar **una** invocación manual autenticada, sin scheduler, con registro de
   origen cloud en el receipt y posterior lectura independiente del ledger.
   Verificar seis tareas, seis claims/heartbeats/resultados y bloqueadas intactas.
   No dar por aprobada la continuidad a partir de este único ensayo.
7. Conectar el lector Preview de Vercel a ese mismo ledger y probar login y menú.

El valor `github_disabled=true` en el ensayo se refiere a que ningún workflow
apunta a ese ledger aislado. No afirma que los workflows del principal hayan
sido apagados. Ninguno fue modificado remotamente en esta sesión.

## Autorización 2: relevo productivo y único scheduler

Solo después del ensayo cloud aprobado y verificado y con autorización diferente:

1. Revisar cuotas y costo total; no comprar planes, extensiones o capacidad.
2. Detener y drenar `victoriosas-infrastructure-availability.yml`,
   `six-agent-observability.yml` y la modalidad de ejecución de `plan-cloud.yml`
   del destino productivo. Conservar autenticación OIDC para rollback. Los
   workflows de CI siguen siendo pruebas, no runtime.
3. Confirmar estado disabled y ausencia de ejecuciones en curso; solo entonces
   registrar `github_disabled=true` en la política autorizada del destino.
4. Establecer owner `supabase_cron` en el health worker; probar que OIDC ya no
   puede escribir mientras ese owner esté seleccionado.
5. El SQL `cloud_runtime_v3_cron_REVIEW_ONLY.sql` verifica extensiones y Vault,
   rechaza un scheduler existente y prepara **un job inactivo**. No instala
   extensiones. Revisar URL de destino y no exponer token en SQL/logs.
6. Activar ese único job después de comprobar que la política, SHA y costos son
   correctos. Verificar al menos dos slots distintos con resultados y lectura
   independiente. No activar sourcing, envíos, modelos o desarrollo arbitrario.

Rollback: desactivar primero el job cloud y la política; drenar leases; conservar
tasks y audit; quitar credenciales del runtime/Preview. Solo con aprobación de
rollback devolver owner a GitHub y rehabilitar los workflows anteriores. Nunca
habilitar simultáneamente ambas fuentes. No borrar ni reabrir tareas bloqueadas.

## eve y AI Gateway

Evaluación: no aportan una capacidad necesaria para este ciclo determinista y ya
persistido. No se instalaron, activaron ni invocaron modelos. eve ofrece runtime
durable y schedules; incorporarlo aquí introduciría otro dueño de continuidad.
AI Gateway serviría para modelos/routing/costos cuando un alcance IA esté
autorizado; no repara por sí mismo lease, scheduler, permisos ni el lector 503.
Fuentes oficiales: [eve](https://eve.dev/docs/getting-started),
[AI Gateway](https://vercel.com/docs/ai-gateway),
[roles y claims Supabase](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac).

## Bloqueos verificables

- No existe ejecución cloud V3 acreditada. Falta la autorización 1 y su fuente
  aislada de consultas, credenciales mínimas y despliegue.
- El 503 desplegado continuará hasta publicar y configurar el lector alternativo.
- No hay prueba de autonomía integral de los cinco roles: el alcance entregado es
  el de observaciones de la tabla anterior; desarrollo/consulta/salida real siguen
  requiriendo su contrato y permisos propios.
- Los checks de #272/#273/#274 fallaron antes de arrancar por billing de GitHub;
  la CI del SHA final de integración se informa separadamente.
- Deno 2.2.7 se instaló solo en `.lab-tools/deno` con `deno-bin@2.2.7`; pasó el
  entrypoint HTTP real (405/404/401/503/200). Supabase CLI 2.81.3 local pasó el
  dry-run de historial en PostgreSQL descartable sin aplicar SQL. CLI 3.4.0
  cambia los flags de ese test histórico; se usó la versión fijada compatible.
  Ninguna de estas pruebas acredita por sí misma integración alojada.

## Ensayo cloud aislado autorizado · 24/11/2026

El propietario autorizó SQL exclusivamente en juyowvmtluxfetgkckjd, credenciales
mínimas, bundle aislado, un ciclo sintético, correcciones técnicas y Preview.
Cron y producción siguen fuera de alcance. Las migraciones de fencing, inbox
sintética, runtime y perfiles aislados se aplicaron allí. Baseline: 1 task y 7
audit events previos, sin bloqueadas; deben conservarse. El principal no se toca.

El proyecto no expone una clave JWT de firma reutilizable y la CLI no tiene
sesión. Se añaden identidades técnicas sintéticas de Supabase Auth con roles
autopilot_cloud_runtime/autopilot_cloud_reader, sin permisos de tablas ni claims
genéricos. Auth firma JWT de corta duración; no se exporta su clave ni se entrega
service_role al runtime. Credenciales locales protegidas con Windows DPAPI.

La modalidad /run-bearer verifica la identidad contra Auth y PostgREST valida
cada RPC con el mismo JWT restringido. Solo el bundle --isolated incluye la
clave PUBLICABLE del ledger exacto y el SHA compilado. No contiene contraseñas,
refresh tokens ni claves privilegiadas. El owner manual_once está limitado a
environment=isolated y un slot fijo; no crea Cron y no permite otros ciclos.

Preview admite login server-side del lector restringido para no quedar inválido
al vencer un JWT copiado. La contraseña se configura como variable sensible
solo de Preview y solo de la rama autopilot-integration. El navegador recibe
únicamente su sesión admin sintética y la clave publicable. RLS del perfil
permite leer solo el perfil propio; no hay escritura desde navegador.

## Resultado del ensayo autorizado

EJECUTADO/VERIFICADO el24/11/2026 a21:07 Uruguay en el ledger aislado, con código
7c353f5e59b71be03958097a86ec8c47915f8197. Receipt completo en
[CLOUD_RUNTIME_ISOLATED_RECEIPT_20261124.json](CLOUD_RUNTIME_ISOLATED_RECEIPT_20261124.json).
Seis cierres/claims/heartbeats/resultados, todos en intento1. La Preview admin
mostró esos seis resultados con HTTP200 y mantuvo401/403 sin autoridad suficiente.
La política quedó cerrada, el runner bloqueado y Cron ausente. Se conservan los
fingerprints heredados y las seis bloqueadas del principal.

La barrera de autorización del primer ensayo descrita arriba quedó satisfecha
por la orden expresa del propietario. Las barreras de producción y periodicidad
permanecen. Próximo paquete: [plan de activación permanente](CLOUD_RUNTIME_PERMANENT_ACTIVATION_PLAN.md).
Las secciones clínicas/settings de la Preview no fueron provisionadas; el503
resuelto es el lector de agentes, no toda la aplicación aislada.
