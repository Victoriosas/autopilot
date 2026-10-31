---
name: base-datos-segura
description: Revisar Postgres, Supabase, RLS y migraciones locales con recuperación.
---

Leer esquema y migraciones. Definir integridad, grants, roles, RLS, aislamiento tenant_id y acceso de servicio. Revisar índices con consultas reales, transacciones, bloqueos e idempotencia. Probar permisos positivos y negativos en base desechable. Preparar migración individual y reversión; no db push/reset ni SQL remoto con autorización general. No leer contenido personal ni colocar service_role en frontend. Verificar historial divergente antes de proponer cambios alojados.
