# Fichas y permisos: instalación pendiente de autorización

## Estado comprobado y resultado local

Producción contrastada: `33f718e3e5894a2a459f5e279d5092be97774320`. Consulta de metadatos del 04/11/2026: `beauty_services` tiene **4 filas** y no existe `private.consultation_service_knowledge`. No se consultaron expedientes ni tarifas reales.

La migración `20261104030000_consultation_service_knowledge.sql` agrega **17 tratamientos**, conservando los cuatro servicios históricos: el resultado esperado es **21 filas**, no 17. Se compararon nombres e identificadores con `serviceDirectory.ts` y se comprobó que no modifica las cuatro filas existentes ni inventa descripción, duración, disponibilidad, tarifas o aprobación. Las 17 fichas privadas siguen sin contenido hasta que Victoria lo cargue.

La migración `20261104041706_beauty_retention_private_rpc.sql`, creada con Supabase CLI, mueve la implementación de limpieza al esquema privado y conserva el RPC público como `SECURITY INVOKER`. Mantiene la misma guarda `auth.uid()`/perfil administrador y el borrado exclusivo de vencidos. Roles anónimo y service_role siguen sin EXECUTE. No programa ni ejecuta limpieza. También habilita RLS en el conocimiento privado, sin políticas amplias ni acceso directo para roles API.

Prueba local: `node scripts/test-beauty-postgres.mjs` inicia y detiene su propio PostgreSQL desechable. Valida privilegios, transiciones, retención, preservación del catálogo, versiones obsoletas, aprobación, vencimiento, aislamiento de tarifas y filtros deterministas. Auth por JWT/PostgREST se verifica aparte en `beauty-stack`; no confundir el fixture SQL de identidad con login real.

## Procedimiento productivo revisable (NO ejecutado)

1. Obtener autorización específica para ambas migraciones sobre `jfjzpwlrhzqbcrvqxhzf`. Confirmar SHA revisado, CI `validate`, `postgres` y `beauty-stack`, y acceso a respaldo restaurable. No usar `supabase db push`: las versiones locales e históricas alojadas no coinciden.
2. Inventariar migraciones remotas y verificar que ninguna de estas dos ya esté aplicada. Guardar en un lugar privado el esquema/ACL de las funciones afectadas y las cuatro fichas previas; no pegar tarifas ni datos personales en logs o Git. Confirmar que `private` no esté expuesto por Data API.
3. Aplicar individualmente el contenido exacto y revisado de `20261104030000_consultation_service_knowledge.sql` mediante la herramienta de migración autorizada, registrando su versión/nombre. Después aplicar `20261104041706_beauty_retention_private_rpc.sql`. La segunda depende del conocimiento creado por la primera. Cada archivo es transaccional; no repetir un archivo parcialmente registrado a ciegas.
4. Verificar en lectura: 21 servicios, 17 IDs canónicos presentes, cuatro filas anteriores preservadas; tabla privada vacía con RLS y sin grants directos; RPC público invoker y privado definer; EXECUTE solo authenticated; guarda administrador y `search_path=''` preservados. Actualizar advisors y registrar únicamente metadatos.
5. Comprobar denegación anónima y funcionamiento del panel administrativo sin guardar contenido ficticio productivo. Victoria completa y aprueba descripciones desde su sesión. La aprobación de descripción, tarifa interna y publicación son controles separados. No ejecutar `beauty_purge_expired_requests()` para verificar: borra datos reales vencidos y requiere autorización propia.

La autorización técnica depende del rol `admin`, no de una identidad de Victoria fijada en SQL. `reviewed_by` aporta trazabilidad, pero cualquier administrador autorizado podría aprobar. Operativamente debe actuar Victoria; una exclusividad por identidad requeriría un diseño y autorización adicionales.

## Reversión sin pérdida de fichas

Si falla una transacción, se revierte completa. Tras instalación, ante un fallo del panel, deshabilitar el uso de conocimiento para IA mediante revocación autorizada de EXECUTE de `consultation_knowledge_facts()` a service_role; conservar todas las revisiones privadas y no borrar las 17 filas. Esto es un procedimiento de contingencia pendiente de autorización, no una acción realizada.

Para restaurar únicamente la ubicación original del RPC de limpieza, un operador autorizado puede ejecutar en una transacción: `DROP FUNCTION public.beauty_purge_expired_requests(); ALTER FUNCTION private.beauty_purge_expired_requests() SET SCHEMA public;`. Verificar dependencias antes: tras la instalación pueden aparecer consumidores nuevos. Recupera la implementación/ACL original y la advertencia conocida; no ejecuta la función. Conservar RLS del conocimiento.

## camelRun, Resend y módulos heredados

La [tarifa oficial](https://run.camelai.com/docs/pricing.md) informa US$0,01 por hora activa y US$0,10/GB-mes almacenado, además del modelo/herramientas. Las pruebas históricas con Gemma registran solo `usage.costUsd=0` de modelo; no prueban costo total cero. No hay exención de cuenta acreditada: **proveedor remoto desactivado, sin nuevas ejecuciones**. La simulación existente permite preparar JSON, límites y revisión humana sin gasto externo.

Diseño del siguiente PR: selector exclusivo de casos sintéticos del servidor → comprensión → evidencia aprobada/vigente sin tarifas → redactor → guardián independiente → validación determinista → borrador `NOT_SENT`. Los prompts de agentes durables y los esquemas del analizador local difieren; no conectar sus JSON directamente. Requiere adaptación explícita, versiones fijadas, ejecución aislada sin historia de clientes, límites, idempotencia y telemetría separada de modelo/runtime/almacenamiento/herramientas. El cuerpo HTTP no admitirá texto libre, identidad real, proveedor ni agente arbitrario. Sin prueba contractual de costo cero, continuar solo con mocks. No reutilizar el generador histórico pagado.

Vercel y Resend se revisaron por metadatos sin revelar valores: dominio de envío verificado y variables presentes no prueban entrega humana. Los módulos de comercio/proveedores/pagos, la variable y dependencias de IA históricas, `server.ts` y el cron de sourcing se clasifican como **heredados con consumidores**; `api-app.ts` aún importa disponibilidad de pagos y registra rutas operativas. No se eliminó infraestructura ni se activó comercio. PRs Dependabot #168/#169 ya cubren actualizaciones: no duplicarlas ni actualizar paquetes sin sus regresiones.
