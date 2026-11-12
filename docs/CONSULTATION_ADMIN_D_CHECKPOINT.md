# Ciclo D — checkpoint de preparación 2026-11-11

Estado histórico al 11/11: BLOQUEADO ANTES DE IMPLEMENTACIÓN. Reanudación técnica del 12/11 documentada abajo.

- Repositorio: Victoriosas/autopilot
- Base PR #227: 335de883e54e933793b3ce67845123c9f9341145.
- PR #225/#226/#227 abiertas en borrador, apiladas correctamente.
- Origin/main observado: 1c44a6389a7bbd6ac9157ac087269e216e654373.
- Worktree exclusivo: C:/autopilot-worktrees/consultation-admin-d-20261111
- Rama: codex/consultation-admin-integration-v1
- Codex session: 01a1c8c0-236d-75c0-88b6-abda9ea79121
- Ejecutor local: Codex v0.167.0, proceso terminó exit 1 tras error de cuota. No hay escritor persistente de esta sesión.
- Mensaje literal: You've hit your usage limit; try again at 2:04 AM. No inferir reanudación automática.
- MCP Supabase solicitó autenticación, no se concedió ni se necesita para pruebas locales.
- Estado PC: checkout C:/autopilot contiene archivos ajenos no rastreados, preservados. No limpiar.
- Directivas leídas: AGENTS.md, docs/PROJECT_DIRECTION.md, docs/OPENCODE_CHECKPOINT.md, .github/copilot-instructions.md. Continuar leyendo checkpoint C y habilidades antes de escribir.
- No implementación, no tests D, no PR D, no CI D, no SQL remoto, no deployment, no modelos externos ni envíos.

Próximo paso manual autorizado después de disponer de cuota Codex: recuperar prompt de C:/autopilot/docs/CYCLE_D_CODEX_HANDOFF_20261111.local.txt, reconfirmar ownership/escritores/PR y ejecutar en ESTE worktree (no crear otro), luego implementar y probar. No iniciar automáticamente otro proceso desde este checkpoint.

## Reanudación autorizada · 12/11/2026

- Titular: esta ejecución Codex, PID 11648 lanzado por 3532; el proceso PowerShell 4476 de Desktop Commander es su lanzador con el mismo encargo. Inventario de procesos en lectura: sin otro escritor identificado en este worktree. No se interrumpieron procesos ajenos.
- HEAD inicial limpio `1908a3f757ef003281e9f9ce9bdc01d5cd2af14a`, descendiente de la base solicitada `335de883e54e933793b3ce67845123c9f9341145`. Bundle local `.git-preservation-d-20261112.bundle` preserva ese HEAD; ignorado y no publicado. Sin archivos ajenos ni sin seguimiento al inicio.
- GitHub confirmó #225/#226/#227 MERGED. #227 terminó en `bee2df1ff6128fb0a8a147690e4cde390b4b2ebd`, fusionada como `fa86b25d6d5bff551befb41e71a52f6613334f99`. Main observado `30e9f41c0713ee1692aeefe0a26e16931d0fe4b1`; validate/postgres/beauty-stack success en ese SHA.
- `git merge-tree --write-tree HEAD origin/main` calculó árbol sin conflictos; merge normal conservó ambas historias, SHA reconciliado `19e648379b5e24362ed823f7ba7e3d3d4e3cf063`. No reset, stash, clean, rebase ni force push. Ningún otro worktree modificado.
- PR D debe usar main como base revisable porque C ya está fusionada allí; apuntar a la antigua rama C incluiría cambios de main ajenos al Ciclo D. Se conserva toda la dependencia C, sin reabrirla ni modificar su rama.

### Cambio y contrato

F1 bandeja fiable / preparación F2, N2 técnico. Panel dentro de `ConsultationInbox`, sin duplicar bandeja. Carga explícita por expediente; estado de revisión, fuentes/versiones, consentimiento, expiración y últimos eventos. Revisión administrativa nunca aprueba hechos ni autoriza comunicaciones. No genera nuevas solicitudes, modelos o mensajes; administra las persistidas por C.

Rutas `/api/beauty/inquiries/admin/:request/material`, `/review`, `/purge`. Guard propio verifica usuario Auth y perfil admin usando exclusivamente `beautyCallerDatabase`, clave pública y JWT llamador. No usa `beautyServerDatabase` ni service role. Mutaciones exigen Origin válido, aprobación vinculada al expediente y cuerpo cerrado; respuestas no-store, errores genéricos, sin logs de proveedor ni reintentos de escritura.

SQL adicional solo staged: `supabase/staged/consultation_material_admin_v1.sql`, rollback homónimo en `staged/rollback`. No cambia C ni migraciones activas. Tres RPC comprueban admin en SQL; búsqueda vacía y EXECUTE denegado a PUBLIC/anon/service_role. La proyección administrativa necesita leer metadatos que C oculta por RLS: devuelve estado/tiempos/eventos mínimos, y fuentes/versiones solo cuando `consultation_material_visible` vigente lo permite. Nunca devuelve padre, contacto, mensaje, huellas o destinatario. Se conservan RLS y CHECK no_send de C.

Revisión compara `updated_at` exacto del servidor bajo bloqueo de fila y reutiliza RPC C/auditoría atómica. Conflicto devuelve 409. Revocación terminal limpia payload; purga solo este expediente, revalida bajo bloqueo, elimina eventos y conserva tombstones de C hasta retención del padre. Purga física requiere confirmación; no scheduler ni purga alojada. Snapshot acotado a 100 registros y 50 eventos recientes por registro, declarado en UI; no paginación histórica completa.

UI descarta datos antes de cada operación, tras error, cambio de expediente, salida/cambio de sesión; aborta al desmontar o cambiar sesión y tiene timeout de 15 segundos. Un temporizador oculta fuentes al vencer el material. Una fuente retirada remotamente después de cargar se detecta al actualizar o actuar; la etiqueta indica vigencia al verificar. No polling ni garantía de disponibilidad continua. Error o acuse perdido exige lectura de reconciliación; no repetir mutación automáticamente.

### Evidencia reproducible

- Node 24.15.0, dependencias mediante `npm.cmd ci --no-audit --no-fund`.
- `node --import tsx --test src/storefront/consultationMaterialAdmin.test.ts`: 2/2, auth negativa de ruta con middleware sintético, validación, aprobación, CAS, no-store, fallo de transporte sin retry y paso exclusivo del JWT a RPC.
- `MATERIAL_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55463/victoriosa_material_test node --import tsx --test tests/consultation-material-postgres.test.ts`: 14/14 sobre PostgreSQL 18 desechable dentro de este worktree. C + D, migración/rollback, RLS, concurrencia CAS con una sola aceptación/evento, revocación, caducidad, purga por expediente, no resurrección, otras consultas conservadas. Claims del fixture no prueban Auth criptográfica.
- `npm.cmd run verify`: 508/508, cero omitidas/fallos, tipos/skills/builds/API aprobados; nueva ejecución final registrada en `output/cycle-d/verify-final.log` local ignorado.
- Navegador real con `scripts/test-consultation-material-browser.ts`, Playwright 1.56.1 y Chrome instalado: panel React real, API/Auth sintéticos, red HTTP externa bloqueada; escritorio 1280 y móvil táctil 390, confirmación/cancelación, acuse perdido, reconciliación, revocación/purga, expiración y sesión perdida. No equivale a dispositivo físico ni Auth alojada. Capturas y logs en `output/cycle-d/`, ignorados.
- Auth/PostgREST real solo en fixture Supabase CI: prueba ampliada con JWT admin/cliente/inválido, RPC D, concurrencia y guard HTTP real. Workflow instala D exclusivamente en la base desechable y ejecuta el arnés navegador. No afirmar éxito hasta consultar beauty-stack del SHA publicado.
- Secret scan y diff-check aprobados antes de publicar; repetir sobre el conjunto final. Primera ejecución sandbox de tsx falló por `uv_os_get_passwd`; pruebas realizadas con ejecución local autorizada fuera del sandbox. Fallos iniciales del arnés (imports, sustitución Auth y puerto HMR) corregidos; no se atribuyen como éxitos.

### Estado y reversión

IMPLEMENTADO y PROBADO localmente; pendiente publicación DRAFT/CI del SHA final al redactar este checkpoint. SHA final, enlace PR y checks se registran en la PR para evitar autorreferencia del commit. Sin merge, deploy, SQL alojado, envíos, modelos, canales nuevos, scheduler, datos reales o gasto de proveedor. Metadatos actuales de Vercel/Resend/camelRun/Supabase alojado no se consultaron: no son evidencia de esta implementación.

Rollback: revertir commit D (o volver a su padre reconciliado) en esta rama; eliminar únicamente funciones D con el rollback staged si se instalaron en laboratorio. C, sus datos y sus claves no se borran por el rollback D. No ejecutar rollback remoto ni restaurar el bundle sobre cambios nuevos.

Siguiente paso: revisar PR y checks exactos, incluida beauty-stack Auth/PostgREST; mantener SQL staged hasta autorización específica y runbook de instalación/retención. Sin activar entregas por aprobar una revisión administrativa.

## Entrega verificable · 12/11/2026

- PR DRAFT [#229](https://github.com/Victoriosas/autopilot/pull/229), base main; sin conflictos al crearla. SHA de implementación `66065535b28fd1b0ce34a41aecee78394fafc57a`.
- En ese SHA: validate (push y PR), postgres (push y PR), beauty-stack, public-browser-smoke y CodeQL SUCCESS. Supabase Preview SKIPPED, no computado como integración.
- beauty-stack completó Auth/PostgREST real local con JWT admin/cliente/inválido, RPC D y guard HTTP; también completó los navegadores sintéticos. No se usó Supabase alojado. Las ampliaciones están en sus fixtures de CI.
- Verify local final exit 0: 508/508, cero omitidas/fallos, builds/API/tipos/skills; SQL 14/14; focales 2/2; navegador final escritorio/móvil táctil con timeout 15 s, cancelación y contraste inspeccionado. Secret scan y diff-check finales correctos. PostgreSQL temporal detenido; artefactos y bundle conservados localmente e ignorados. Worktree limpio después del commit funcional.
- Este cierre documental es posterior al SHA funcional probado; no altera código, SQL ni workflows. Sus checks validate/postgres se consultan por el SHA documental en la PR, sin atribuirle una ejecución beauty-stack que no corresponda a sus paths.
- Estado D: IMPLEMENTADO / PROBADO local y CI, PR DRAFT. NO FUSIONADO, NO DESPLEGADO, NO EJECUTADO con datos reales. Siguiente acción humana: revisar la PR y decidir el runbook de instalación staged por separado; no activar comunicaciones.
