# SQL locales históricos: solo fixtures

Estos 41 archivos conservan las migraciones locales anteriores a la reconciliación del 04/11/2026. Sus versiones y algunos contenidos difieren de lo ejecutado remotamente; seis propuestas comerciales nunca se instalaron. Los tests aislados siguen utilizándolos para sus contratos históricos. No copiarlos a `supabase/migrations` ni enviarlos a proyectos alojados.

`supabase/migrations` contiene exclusivamente las 41 versiones recuperadas en lectura del proyecto principal. El snapshot de comparación es `tests/fixtures/remote-migrations-20261104.json`. Los dos SQL base fuera de migraciones (`supabase/migration.sql` y `supabase/migration-sourcing.sql`) preceden al historial remoto y solo se usan para inicializar fixtures vacíos. No se agregan como migraciones pendientes en producción.
