# Reconciliación de Supabase Preview · 04/11/2026

## Causa y evidencia

Base contrastada: `81336f2ab3cf4c4ed28ce7c100ad16b7d4355756`. El check Supabase Preview de ese commit falla con `Remote migration versions not found in local migrations directory.`

La consulta de lectura de `supabase_migrations.schema_migrations` recuperó 41 registros con nombre, versión y SQL. Solo tres versiones coincidían con el directorio anterior. Siete entradas remotas carecían de contraparte local del mismo nombre y 11 pares con nombre compartido tenían diferencias textuales aun normalizando CRLF y espacios finales. No se asume equivalencia semántica de esos SQL.

Las versiones productivas de conocimiento y permisos son `20261104045138` y `20261104045219`. No se repiten las versiones locales `20261104030000`/`20261104041706`.

## Cambio exclusivamente en Git

- `supabase/migrations` reproduce exactamente los 41 registros recuperados, en orden remoto, incluido contenido. `tests/fixtures/remote-migrations-20261104.json` conserva el snapshot sin credenciales ni datos de clientes. El test compara SHA-256 normalizando únicamente finales de línea.
- Las 41 propuestas locales originales se conservan en `supabase/legacy-migrations`, fuera de descubrimiento de despliegues. Los fixtures aislados usan esa ruta. Seis propuestas comerciales no aplicadas no deben convertirse accidentalmente en migraciones pendientes. Los SQL staged también se conservan.
- No hay modificaciones remotas de versiones, SQL, permisos o datos. No hacen falta `migration repair`, `INSERT` en el historial ni cambios de filas productivas para esta corrección. No ejecutar `db push` real como parte de la PR.
- El fixture de `beauty-stack` ahora reproduce los 41 SQL reales, sobre los dos SQL base históricos que preceden al historial. Esos dos prerrequisitos se instalan solo en el stack vacío desechable; no se agregan como migraciones productivas pendientes.

## Reproducción y límites

`node scripts/test-hosted-replay-postgres.mjs --history-only`, con Supabase CLI en PATH o `SUPABASE_CLI_PATH`, crea su propio clúster loopback y una tabla de historial sintética con las 41 versiones. La CLI en `db push --dry-run --db-url` reproduce el error con la carpeta antigua y detecta cero pendientes con la carpeta reconciliada. El test comprueba que historial y esquema no cambien. El texto "remote" de la CLI describe su modo de conexión: el destino verificado es siempre `127.0.0.1`, nunca Supabase alojado.

El replay histórico anterior conserva sus regresiones. El replay completo de los 41 SQL y Auth/PostgREST depende de `beauty-stack` (pg_cron/Vault son prerrequisitos gestionados de Supabase y no están disponibles en PostgreSQL Windows). No sustituir esa prueba por stubs presentados como integración completa.

Supabase Preview debe volver a evaluarse en el SHA de la PR. Si la integración omite previews o no los habilita, informar NO VERIFICADO: no crear ramas pagas, borrar/recrear previews, modificar ajustes o reparar historial para forzar un verde.

## Revisión y recuperación

Antes de fusionar: confirmar que el historial remoto no cambió, revisar los 41 hashes y CI final. La aprobación humana de la PR es independiente de cualquier autorización productiva. Tras una fusión autorizada, comprobar que la integración no anuncie SQL pendiente antes de permitir una aplicación.

Revertir esta PR restaura las rutas/versiones antiguas y su fallo conocido; no revierte ni borra esquema o datos alojados. Si aparece un conflicto nuevo, detener la integración y capturar metadatos. Cualquier reparación remota futura requeriría respaldo restaurable, plan SQL individual y autorización específica; esta propuesta no incluye ni necesita esa reparación.

Fuentes oficiales: [CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [troubleshooting de branching](https://supabase.com/docs/guides/deployment/branching/troubleshooting).
