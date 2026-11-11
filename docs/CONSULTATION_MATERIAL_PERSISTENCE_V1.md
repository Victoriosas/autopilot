# Ciclo C · Persistencia supervisada de solicitudes de información

Base comprobada: #226, `e6b455e23361871e373d755cf9b347df147bfa4c`. Worktree `/workspace/autopilot-cycle-c`, rama `codex/consultation-material-persistence-v1`. SQL staged, sin aplicar a servicios alojados. No endpoint, bandeja, modelo, envío ni scheduler nuevo.

## Modelo y permisos

`public.consultation_material_requests` amplía el expediente `consultation_requests` por FK con cascada. Guarda ID, operation_id, intención, canal solicitado, clase de material, referencias/versiones/procedencia y SHA-256 de fragmentos (no el fragmento), huellas de contexto, consentimiento, revisión administrativa, actor y tiempos. No copia nombre, contacto, mensaje, texto de respuesta o destinatario. `delivery_decision` está restringido a `no_send` por CHECK y no hay campo que otorgue autorización de entrega.

`consultation_material_events` conserva acciones created/reviewed/rejected/revoked, administrador y tiempo. Su lectura permite auditoría mínima de administradores incluso después de revocar el material; carece de contenido o destinatarios. La purga elimina el registro y sus eventos. La FK del expediente elimina también sus claves de operación.

Se reutiliza el rol admin en `profiles`, `auth.uid()` y el cliente Supabase con JWT del llamador. SELECT usa RLS; INSERT/UPDATE/DELETE directos se deniegan, también a service_role. Las RPC SECURITY DEFINER tienen search_path vacío, comprueban admin en cada operación y no se conceden a anon/service_role. Las claves privadas y la secuencia de auditoría no se conceden a clientes.

## Circuito seguro e idempotencia

1. `persistConsultationMaterial` exige token, consentimiento, operation_id UUID estable y solicitud de material del borrador B. Obtiene la consulta consentida vigente mediante RPC y compara su entrada con la del borrador.
2. El Guardián B vuelve a validar texto, fuentes, versiones y contexto; blocked impide escribir. requires_information puede registrarse como pendiente, nunca como contenido autorizado.
3. La RPC vuelve a comprobar consentimiento/expediente y sus huellas, así como fuentes actuales con hashes exactos. Catálogo y políticas públicas quedan fijados al manifiesto vigente de A; las fichas profesionales se validan contra `consultation_knowledge_facts`, que excluye versiones retiradas o vencidas. Un cambio de fuente después del control en TypeScript no autoriza una escritura obsoleta en SQL.
4. Bloqueo del expediente + clave única `(request_id, operation_id)` serializa escrituras concurrentes. Reintentos idénticos devuelven el mismo ID sin crear otro evento. El mismo operation_id con otro payload provoca conflicto. No hay reintentos ciegos de transporte; el operador puede reconciliar/reintentar la misma operación.
5. Lectura y revisión vuelven a comprobar consentimiento, hash del expediente, vigencia y fuentes. Un cambio del padre o de una fuente oculta el material pendiente. Revisar administrativamente no aprueba contenido y no autoriza enviar.

El SQL valida versiones/hash de catálogo publicado además de las fuentes profesionales. Al cambiar el manifiesto publicado deberá revisarse también esta proyección SQL; una versión nueva no reconocida falla cerrada. La validación transaccional corresponde a su snapshot; una retirada posterior invalida la siguiente lectura/revisión. Esto no concede autorización de envío ni pretende bloquear toda futura edición de conocimiento.

## Expiración, revocación y eliminación

El material vence en el mínimo de siete días, caducidad del expediente y caducidad del contexto autorizado. Fuentes vencidas o retiradas lo ocultan inmediatamente en lecturas nuevas. Un admin puede revocar la operación: estado terminal, consentimiento revocado y payload borrado en la misma transacción. La retirada de consentimiento en el expediente oculta sus materiales y permite purgarlos.

`consultation_material_purge()` requiere admin y elimina únicamente materiales vencidos, revocados o invalidados por padre/fuentes, con eventos por cascada. No se crea tarea automática: la eliminación física requiere invocación controlada del operador; la expiración lógica es inmediata. El rollback borra solo los objetos de C y sus datos, por lo que exige revisión previa de retención/exportación antes de usarse fuera de laboratorio.

`private.consultation_material_keys` retiene solo UUID padre/operación/registro, hash y tiempos hasta que se elimina el expediente padre conforme a su retención existente. Evita que un reintento resucite una operación purgada. No guarda contenido, contactos o instrucciones. Purga/revocación marca el retiro; borrar el expediente elimina las claves. Revocar una operación no equivale a retirar globalmente el consentimiento del expediente: otra operación deliberada exige de nuevo consentimiento vigente y autorización administrativa.

## Pruebas reproducibles

Node 24 y dependencias del lockfile. PostgreSQL debe ser desechable, loopback y base exclusiva `victoriosa_material_test`. El test crea solo roles/fixtures de laboratorio y usa `auth.uid()` con claims suministrados por el fixture; esa prueba demuestra RLS/SQL, no autenticación criptográfica.

```bash
MATERIAL_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/victoriosa_material_test \
node --import tsx --test tests/consultation-material-postgres.test.ts
node --import tsx --test src/storefront/consultationMaterial.test.ts
node --import tsx scripts/eval-consultation-faq.ts --grounded
npm run verify
node scripts/secret-scan.mjs
```

El test PostgreSQL aplica el SQL staged, verifica concurrencia, replay, conflictos, no_send, consentimiento ausente/revocado, contexto corto, fuentes modificadas/retiradas/vencidas, RLS, auditoría, privilegios de secuencia, purga y prevención de resurrección; ejecuta rollback/reinstalación sin alterar el expediente padre. El test falla si se omiten las variables de base aislada.

La CI postgres ejecuta este archivo en su propia base. La CI Beauty copia el SQL staged únicamente a su fixture desechable, después de las migraciones canónicas, y ejecuta `tests/consultation-material-supabase.test.ts`: usuarios/JWT admin y cliente reales, RPC/PostgREST/RLS, cuatro escrituras concurrentes, token inválido, denegación de mutación directa y revocación/purga sin resurrección. No se añaden versiones a `supabase/migrations` ni se altera el inventario alojado.

Resultados locales: 13/13 pruebas PostgreSQL (incluye el test contenedor), 3/3 unitarias de la capa de aplicación, evaluación A/B de 228 casos sin fallos. `npm run verify` exit 0: 487 pruebas, 486 aprobadas y una omitida específica de Windows; tipos, 13 skills y ambos builds/API compiladas aprobados. Escaneo de secretos, YAML y diff aprobados. Auth/PostgREST real se verifica por separado en CI del SHA final, no se atribuye a la prueba de claims del fixture PostgreSQL.

Fuentes de rollback: `supabase/staged/rollback/consultation_material_requests_v1.sql`. Aplicar solo a la instancia de laboratorio creada para el ensayo; no se ejecutó contra producción. Las regresiones A/B y sus 228 casos permanecen sin modificaciones.

## Checkpoint durable

- cycle_id: VICTORIOSAS_CONSULTATION_MATERIAL_PERSISTENCE_V1.
- base_sha: e6b455e23361871e373d755cf9b347df147bfa4c; PR base #226.
- Titular: Codex de esta sesión; PID local 605 observado. No se halló otro escritor local ni una PR C equivalente antes de crear el worktree. Checkouts previos preservados, sin interrupciones de procesos ajenos.
- Estado al commit: pruebas locales ejecutadas, CI pendiente; SHA final, URLs y resultados del cierre se registran en el checkpoint de la PR en borrador para evitar auto-referencias del commit.
- Riesgos: SQL staged no instalado en producción; validación Auth real corresponde al fixture CI; no contrato multicliente ni autorización para comunicaciones. Las huellas son datos técnicos ligados al expediente y comparten su retención, no anonimización irreversible.
- Siguiente acción: comprobar checks del SHA final y dejar revisión humana. Una futura integración D podrá listar solicitudes con JWT admin, mostrar estado/fuentes y revocar; debe conservar separación entre persistencia, revisión de contenido y permiso específico de entrega.
