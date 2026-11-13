# P0C · Provisión aislada del ledger sintético

Fase F0/N2, soporte técnico de F1–F4. Base verificada: main
`a63ed47a3b79b3ca109fdaba30ecf77f46a37fc2` (P0B, PR231).
Estado: PREPARADO para revisión; ninguna mutación alojada ni credencial configurada.
La autorización identifica exclusivamente `juyowvmtluxfetgkckjd`, con `public` vacío
y base predeterminada `postgres`, según la información aportada por el propietario.
No se inspeccionó ni modificó `jfjzpwlrhzqbcrvqxhzf`; su host queda rechazado.

## Cambio mínimo

`CloudMissionStore` admite `postgres` solo en
`db.juyowvmtluxfetgkckjd.supabase.co:5432`, TLS `verify-full`, CA explícita y
`autopilot_cloud_runner` sin administración ni membresías. La configuración local
conserva su nombre fijo; el transporte cloud utiliza el nombre real al conectar
y al comprobar SQL. Para `postgres` exige además el marcador de proyecto alojado.
La guarda de binding, leases, fencing y presupuesto sigue en el ledger existente.

`supabase/staged/hosted_synthetic_ledger_p0c.sql` es una **plantilla staged**;
`scripts/hosted-ledger-sql.mjs` ensambla su SQL con los cinco archivos fuente
existentes y los permisos P0B. No es una migración automática de la aplicación,
no crea historial Supabase ni reproduce sus migraciones generales. No usar
`db push`, reparación de historial ni `LocalMissionStore.initialize()` alojado.

La transacción exige base `postgres`, sesión `postgres`, confirmación de proyecto,
binding hexadecimal, `auth.role()` existente, rol runtime dedicado y ausencia de
relaciones y funciones en `public`. No reemplaza `auth`, no crea roles/contraseñas,
no admite misiones y no crea disparadores. Un fallo revierte todo; una repetición
falla antes de cambiar el ledger. El marcador SQL es una afirmación del operador,
no una identificación criptográfica del proyecto: el ejecutor de provisión debe
fijar el host exacto, CA y base antes de conectar. Nunca usar URL libre o pooler.

Revoca privilegios por defecto de API sobre tablas, secuencias y funciones a
PUBLIC/anon/authenticated/service_role. RLS en todas las tablas; runtime recibe
SELECT y únicamente los siete RPC de recuperación existentes. Sin admisión,
claims generales, DML directo ni CREATE en `public`. Los SECURITY DEFINER
heredados conservan `search_path=''`; no se añaden endpoints públicos.

## Credenciales requeridas (solo GitHub Secrets)

Crear **después de revisar y autorizar** el environment `p0c-hosted-ledger`, con
revisor humano obligatorio y despliegues permitidos solo desde `main`. No basta
con que GitHub lo cree implícitamente. No colocar secretos a nivel de PR ni en
configuraciones JSON, variables de repositorio, comandos, artefactos o logs.

| Nombre | Alcance |
| --- | --- |
| `P0C_LEDGER_CA_CERT` | Certificado CA PEM del proyecto, validado fuera del repositorio |
| `P0C_LEDGER_RUNNER_PASSWORD` | Contraseña del login SQL dedicado, no API key ni service role |
| `P0C_LEDGER_ADMIN_PGPASS` | Solo futura provisión supervisada: entrada pgpass de `postgres` para el host exacto, sin comodines; nunca disponible al job runtime |

El workflow entregado **solo consume los dos primeros**. No contiene ejecución
remota de provisión ni creación de credenciales. El tercero queda como requisito
del paso administrativo futuro, cuya ejecución aún debe revisarse/autorizarse.
No requiere SUPABASE_ACCESS_TOKEN, URL de producción, claves de aplicación,
Resend, modelo ni servicio adicional. No leer/copiar secretos de otros proyectos.

## Preparación y pasos posteriores a la revisión

1. Revisar diff completo, SQL ensamblado, privilegios y pruebas del SHA final.
   Revisión de seguridad/migración y aprobación alojada siguen pendientes.
2. Generar **offline**, sin credenciales ni conexión, identidad de la semilla:

   ```text
   node --import tsx scripts/hosted-ledger-host.mjs
   node scripts/hosted-ledger-sql.mjs <binding> juyowvmtluxfetgkckjd <archivo-temporal-fuera-del-repo.sql>
   ```

   El primer comando devuelve `baseSha` y `binding`; semilla fija reproducible
   entre runners. El segundo escribe exclusivamente SQL sin secretos, con
   creación exclusiva de archivo; revisar también los archivos fuente incluidos.
3. Tras aprobación específica, preparar un login nuevo `autopilot_cloud_runner`
   con LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION,
   NOBYPASSRLS, sin membresías ni privilegios previos. Establecer SCRAM mediante
   canal administrativo secreto; no insertar contraseñas en SQL versionado/logs.
   Esta entrega no realiza ese cambio de credenciales.
4. En una sesión administrativa supervisada de GitHub Actions, restringida al
   mismo SHA revisado y environment protegido, materializar `P0C_LEDGER_ADMIN_PGPASS`
   y CA únicamente en RUNNER_TEMP con modo 0600 y trap de limpieza. Usar `psql`
   con host **literal** `db.juyowvmtluxfetgkckjd.supabase.co`, puerto 5432,
   usuario/base `postgres`, `-w -X -qAt -v ON_ERROR_STOP=1`,
   `PGSSLMODE=verify-full`, `PGSSLROOTCERT` y `PGPASSFILE` explícitos.
   Entorno PG limpio, sin PGOPTIONS/PGHOSTADDR/PGSERVICE ni shell tracing;
   SQL por stdin y stderr suprimido, publicar solo éxito/fallo. Verificar destino
   y `public` vacío antes de ejecutar el archivo ensamblado una sola vez.
   No se ha añadido ni ejecutado ese paso administrativo al workflow.
5. Comprobar únicamente metadatos de rol, RLS, ACL, `auth.role()` preservado y
   binding. Registrar SHA del SQL y resultado saneado. No reintentar a ciegas.
   La admisión de una nueva ID `synthetic-*` con objetivo canónico no_send
   requiere otro paso administrativo explícito; el runner nunca admite objetivos.
6. Solo tras provisión/admisión aprobadas, configurar variable de repositorio
   `P0C_HOSTED_REVIEWED_SHA` al SHA **exacto en main** que se autorizó. Cambiar
   el código invalida esta puerta. Despachar el workflow existente PLAN Cloud,
   modo `hosted-status` y la ID previamente admitida; luego `hosted-resume`
   únicamente para la prueba sintética aprobada. Requiere aprobación del environment.

Estos pasos son un runbook revisable, no una instrucción de ejecución actual.
No se despachó ningún job alojado, se modificaron secrets, ni se configuró la variable.

## Workflow y límites

Se reutiliza `.github/workflows/plan-cloud.yml`: modos manuales status/resume,
solo main + SHA revisado + environment. En PR y workflow_run nunca se materializan
estas credenciales; la continuación automática conserva `blocked`. El script
valida de nuevo SHA/ID/acción y crea CA/pgpass/config privados en un directorio
temporal, excluye variables heredadas y limpia al terminar. Solo imprime identidad
sintética y resultado acotado; suprime stdout/stderr de la CLI con datos del ledger.
No sube credenciales/configuración como artefactos. La eliminación de archivos
ante terminación forzada depende además de la destrucción del runner efímero.

La conexión directa puede exigir IPv6 disponible en el runner; si falla, registrar
bloqueo. No comprar IPv4 ni sustituir por otro proyecto/pooler. Documentación:
[conexión PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
[roles](https://supabase.com/docs/guides/database/postgres/roles).

La semilla es reproducible; los worktrees/artefactos son efímeros por job. **P0C no
acredita recuperación de efectos entre hosts con almacenamiento compartido**.
No se habilita continuación desatendida ni se afirma servicio 24/7. Reutiliza
resume, MissionLedger y PersistentMissionOrchestrator; sin scheduler ni cola nuevos.
Sin app deploy, producción, envíos reales, inferencias o servicios pagos.

## Validación y reversión

`tests/cloud-ledger-postgres.test.ts` usa clúster TLS loopback propio, sin secrets
ni fallback remoto. Conserva muerte/recuperación de dos procesos P0B y añade
provisión en `postgres` local con auth preexistente y privilegios API por defecto;
usuario de provisión sin superuser, rollback por esquema ocupado, repetición
rechazada, RLS/ACL, auth preservado, status/claim/cancel reales y permisos negativos.
El transporte del caso hosted se redirige **solo dentro del test** a loopback;
la configuración de producción jamás permite esa redirección.

Reproducir con `npm run verify`, secret scan, HTML/assets y la prueba TLS P0B
documentada en [CLOUD_LEDGER_P0B_20261112.md](CLOUD_LEDGER_P0B_20261112.md).
Resultados por SHA y checkpoint: `docs/OPENCODE_CHECKPOINT.md` y PR borrador.

Resultado local: `npm run verify` exit 0, **515/515**, tipos/skills/ambos builds/API.
Fixture TLS conjunto **1/1 sin omitir**, 69 s: P0B recuperado en intento 2 con
tres escrituras obsoletas rechazadas; P0C en `postgres`, provisión sin superuser,
auth conservado, ACL y repetición rechazadas. HTML/assets, secret scan y diffcheck
aprobados. YAML parseado sin añadir schedule; runner sin configuración rechazado.
Semilla offline: `ca765c578205d0af92f4403cc6d6cce5ad57f662`;
binding: `263f17927216cb1d06dff0426359e0631886685d392d669acb29851779740983`.
Veredicto interno: APROBADO solo para preparar/revisar el candidato local;
revisión humana de seguridad/migración y ejecución alojada PENDIENTES.
Los ensayos iniciales detectaron cierre de stdin en negativos, sustitución de `$$`
al ensamblar y protección del rol bootstrap en PG18; corregidos y revalidados.

Rollback antes de ejecutar: cerrar/revertir PR, mantener variable ausente y secretos
sin configurar. Después de eventual provisión autorizada: retirar variable/permiso
de dispatch, detener runners y conservar ledger para auditoría; revocar login/grants
solo bajo aprobación administrativa. No borrar esquema/historial ni resetear
checkpoints automáticamente. El proyecto existente nunca forma parte del rollback.
