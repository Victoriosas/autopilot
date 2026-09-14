# Preflight de migración Supabase Autopilot V4

Fecha: 2026-09-14 22:36 UTC  
Proyecto: `jfjzpwlrhzqbcrvqxhzf`

## Resultado

- `SAFE_TO_MIGRATE`: sí, según las comprobaciones de solo lectura.
- `MIGRATION_READY_FOR_PRODUCTION`: true.
- `MIGRATION_APPLIED`: false.
- No se ejecutó `apply_migration` ni ningún `INSERT`, `UPDATE`, `DELETE`, compra, publicación o pago en producción.

## Estado observado

La migración `20260914215143_durable_sourcing_orchestrator` no figura entre las migraciones instaladas. En producción existen las migraciones hasta `20260912215447_catalog_archive_and_clear`.

Antes de migrar:

- `autopilot_product_drafts`: 0 filas; las 11 columnas legacy existen y las 5 columnas nuevas no existen.
- `autopilot_sourcing_runs`: inexistente.
- `autopilot_sourcing_items`: inexistente.
- `autopilot_sourcing_command(text,jsonb)`: inexistente.
- `publish_autopilot_draft(uuid)`: existe con la firma esperada.
- `products`: 0 filas; no existe `commercial_identity`.
- Publicaciones en curso: 0.
- Conflictos de identidad y de `source_candidate_id`: 0.
- `autopilot_product_drafts`: RLS habilitado, sin policies; el esquema actual conserva grants legacy a `anon` y `authenticated`.
- Triggers con nombres de Autopilot en las tablas objetivo: no existen.

## Auditoría de compatibilidad

La migración es aditiva para tablas y columnas. Sus índices únicos no chocan con datos actuales porque drafts y products están vacíos. La función de publicación existente recibe un UUID y usa las columnas legacy presentes; la migración añade las barreras antes de cualquier publicación futura. Los triggers nuevos tienen nombres libres y las funciones nuevas no colisionan con rutinas existentes.

La migración habilita RLS en las tablas durables, revoca acceso de `public`, `anon` y `authenticated`, y concede operaciones únicamente a `service_role`. Esto corrige el acceso amplio legacy sin eliminar filas. El advisor de Supabase sigue reportando el hallazgo informativo `rls_enabled_no_policy` en tablas internas existentes; no impide esta migración y debe tratarse en una revisión de seguridad separada.

## Condición de aplicación

El preflight es seguro, pero la política operativa actual prohíbe cambios directos en Supabase producción durante esta fase. Por tanto, la acción correcta es conservar la migración lista, aplicar primero en un entorno seguro y repetir el mismo preflight antes de cualquier ventana de producción.

## Verificaciones posteriores requeridas

En un entorno seguro deben validarse lectura y creación de drafts shadow, barrera de origen, `publication_eligible=false`, claims de lease/fencing, resume, idempotencia y `completed_no_candidates`, manteniendo checkout desactivado, límite de compra en cero y auto-order desactivado.
