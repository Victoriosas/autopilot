# P0B · Adaptador durable de ledger para runners sintéticos

Fase F0/N2: infraestructura de recuperación que apoya F1–F4 sin activar fases posteriores.
Dependencia: [PR230](https://github.com/Victoriosas/autopilot/pull/230),
SHA `25b12155c1cf5e5ededd45135409f5867b7beba7`; main contrastado `30e9f41`.

## Contrato y alcance

La misma CLI admite `resume --config FILE --id synthetic-ID`. `readMissionHost`
selecciona explícitamente `local_synthetic_lab` o `cloud_synthetic_lab`.
`CloudMissionStore` sustituye exclusivamente el transporte SQL de `LocalMissionStore`.
Reutiliza `createMissionLedger`, `PersistentMissionOrchestrator`, el planificador,
el ejecutor sintético, los RPC y la tabla `agent_tasks` existentes. No crea cola,
scheduler, daemon, modelo ni endpoint público. PLAN Cloud conserva el cierre seguro
de PR230; no se conecta automáticamente a una base ni ejecuta código del disparador.

El binding durable deriva de `ledgerId`, SHA de la semilla y dominio sintético.
Las rutas del runner, los alias DNS y los archivos de credenciales pueden variar
sin readmitir ni resetear la misión. SQL sigue siendo autoridad para exclusión,
presupuesto, expiración, cancelación, versiones y fencing. Cada recuperación usa
un UUID de run y un token nuevos. Terminales son no-op; un lease vivo devuelve exit 3.

El adaptador requiere PostgreSQL con TLS `verify-full`, CA explícita, archivo de
contraseña explícito y rol `autopilot_cloud_runner` sin privilegios administrativos
ni membresías. No hereda contraseñas, opciones, servicios, redirección ni preloads
del entorno. Certificado/archivo ausentes o inválidos, binding ajeno, configuración
extra o destino fuera del nombre fijo de laboratorio impiden ejecutar. Los errores
de procesos se reducen a códigos; tokens y stderr SQL no llegan a los eventos.
Referencia: [verificación TLS de PostgreSQL](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Configuración del host (solo estructura, sin credenciales)

```json
{
  "version": 1,
  "mode": "cloud_synthetic_lab",
  "ledgerId": "synthetic-ledger-example",
  "database": {
    "host": "ledger.example.invalid",
    "port": 5432,
    "name": "victoriosa_mission_operator_lab",
    "user": "autopilot_cloud_runner",
    "sslRootCert": "/runner/config/ca.crt",
    "passFile": "/runner/private/ledger.pgpass"
  },
  "resources": {
    "repository": "/runner/seed",
    "worktreeRoot": "/runner/worktrees",
    "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "permissions": { "admit": false, "execute": true, "cancel": true },
  "leaseSeconds": 30,
  "deadlineMs": 25000,
  "queryTimeoutMs": 3000
}
```

Los paths deben ser absolutos, reales y sin symlinks; worktrees fuera del repositorio.
Archivo de contraseña privado (0600 en Unix; ACL privada responsabilidad del host Windows).
Requiere `psql` instalado; no descarga herramientas ni descubre credenciales alojadas.
El nombre de base es deliberadamente fijo y exclusivo de laboratorio. No usar la
base de la aplicación. El rol runtime no inicializa ni admite objetivos.

La preparación offline requiere base desechable vacía, bootstrap local existente,
binding cloud explícito y rol LOGIN dedicado creado por el operador. Aplicar
`supabase/staged/cloud_synthetic_ledger_20261112.sql` únicamente allí. Ese SQL
otorga SELECT con RLS y ejecución de los RPC estrictamente necesarios, sin DML,
DDL, admisión ni claim general de la cola. No es una migración de producción.
No se configuró host, secreto ni base remota durante esta entrega.

## Prueba reproducible

```text
npm run verify
node scripts/secret-scan.mjs
node scripts/check-route-html.mjs
CLOUD_LEDGER_FIXTURE=1 PG_BIN=<directorio PostgreSQL> node --import tsx --test tests/cloud-ledger-postgres.test.ts
```

En PowerShell usar `npm.cmd` y `$env:CLOUD_LEDGER_FIXTURE='1'`; `OPENSSL_PATH`
permite indicar la instalación existente de OpenSSL. La prueba crea su propio
clúster PostgreSQL en loopback/puerto libre, CA efímera, login SCRAM de fixture y
repositorio de un único archivo sintético. Al terminar detiene y elimina el clúster.
CI `postgres` ejecuta esta misma prueba; no usa secrets ni base alojada para P0B.

Resultado local: `npm run verify` exit 0, **512/512**, skills/tipos/ambos builds/API.
HTML/assets y secret scan aprobados. Prueba TLS final: **1/1**, sin omitir, ~70 s.
Dos procesos CLI independientes A/B sobre un mismo ledger persistente y volumen
sintético compartido; no acredita dos máquinas alojadas ni operación desatendida.

1. A deriva plan, completa prepare y escribe el efecto. Un gate SQL de fixture
   retiene el checkpoint posterior al efecto; B observa busy sin consumir intento.
2. SIGKILL real mata A; la sesión SQL pendiente termina por timeout. Se espera la
   expiración natural del lease. La versión del checkpoint permanece intacta.
3. B reclama la misma ID y plan con run/token nuevos, reconcilia el efecto sin
   cambiar mtime y completa en el intento 2. Mientras B tiene el lease, fail,
   checkpoint y complete con el token de A son rechazados.
4. Otra reanudación terminal no altera versiones; logs sin token; CA inválida,
   credencial ausente y ledger ajeno bloqueados; rol runtime rechazado para DDL,
   UPDATE directo, admisión y claim general. Provisión cloud por CLI rechazada.

## Revisión, límites y rollback

Supervisión interna APROBADA para transporte y laboratorio: contrato reutilizado,
privilegios reales negativos y fencing durante propiedad del reemplazo verificados.
La primera ejecución detectó una carrera en el gate de prueba: se liberaba antes
de terminar la sesión del runner muerto. Se corrigió la sincronización del fixture
y se volvió a probar con rechazo de token durante el lease de B.

Durabilidad del ledger no persiste artefactos del filesystem. Esta demostración
usa un volumen sintético compartido y semilla idéntica. Recuperación entre hosts
sin ese volumen requiere un adaptador de artefactos autorizado y su propia prueba;
no se promete exactamente una ejecución de efectos externos. No hay datos reales,
credenciales reales, SQL alojado, envío, merge, deploy ni cambio del heartbeat.

Rollback: revertir P0B y conservar PR230; retirar únicamente el clúster/rol de fixture
tras terminar sus runners. No borrar checkpoints para forzar otra ejecución.
Siguiente puerta: revisar PR/CI por SHA y definir una prueba cloud aislada autorizada
con identidad, persistencia de artefactos, retención y coste conocidos. No activarla
por existencia del adaptador. Git deployments de esta rama deshabilitados.
