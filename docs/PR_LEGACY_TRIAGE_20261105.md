# Depuración de PR y preservación de evidencia · 06/11/2026

Sustituye el inventario del 05/11 basado en 8f1afe4, cuyos prompts y estado de laboratorio ya cambiaron. Base revisada: cfce910fc6624a0e43613cf0f30d0ca18250ef80. Autorización del propietario: ejecutar la depuración propuesta, con pruebas y preservación del trabajo. No autoriza modelos pagos, mensajes, SQL alojado, DNS ni cambios comerciales.

## Decisión por PR

| PR | Decisión y evidencia |
| --- | --- |
| [#186](https://github.com/Victoriosas/autopilot/pull/186) | FUSIONADA como 5f1f0f8 tras actualizar main; validate/postgres, OpenCode y CodeQL aprobados; sin hilos pendientes. Head revisado 64f59f017884cb37ed6d1541bdd02afdcee093f7. Solo instrucciones y README: Codex principal, OpenCode auxiliar y dirección profesional vigente. |
| [#188](https://github.com/Victoriosas/autopilot/pull/188) | FUSIONADA como 5d175c2 tras actualizar main: head 01953cd7e542624496b35c3fdaf5a0d6c50f2e93 con validate/postgres/CodeQL aprobados y sin hilos pendientes. Chrome local/API simulada: 17 servicios, un borrador guardado, ninguna aprobación IA, protección de cambios sin guardar, cero errores JS/correos/modelos. Captura en tmpdir, sin ruta fija E:. |
| [#187](https://github.com/Victoriosas/autopilot/pull/187) | Informe actualizado: conserva decisiones y referencias históricas. No repetir igualdad de prompts ni ausencia de ejecución real del informe anterior. |
| [#168](https://github.com/Victoriosas/autopilot/pull/168) | FUSIONADA como 9bb5264f8cebdd990634e80d6408e91a4f08788b. Head e3dfe9a185c041e0ab090308945fbf186d87a55c: validate/postgres 42155993340, navegador 42155993343, CodeQL y Vercel aprobados. Local verify 412/412 y Chrome 390/1365 sin errores ni overflow. GenAI 2.32/Lucide 1.66; Express sigue en 4. El fallo Cloudflare pertenecía al head anterior; no se cambió hosting ni se acredita un nuevo build Cloudflare. |
| [#169](https://github.com/Victoriosas/autopilot/pull/169) | Convertida a DRAFT y documentada como BLOQUEADA, sin fusionar: Express 4→5 y tipos 5. CI 41767936846 falla por parámetros string o string[] en consultationRouter/intelligenceRouter; requiere migración y pruebas independientes. Propuesta original conservada. |
| [#129](https://github.com/Victoriosas/autopilot/pull/129) | Cerrar como superada, conservando rama/commits. Los diez nombres de tests originales siguen en main junto con regresiones nuevas. Corpus congelado idéntico; prompts distintos por #191. Main añade esquemas, cobertura completa, límites de costo, seguimiento GET y protección de finales. No seleccionar versiones antiguas al resolver conflictos. |
| [#131](https://github.com/Victoriosas/autopilot/pull/131) | Cerrar como superada, conservando rama/commits. Gateway/tests ya existen. Main agrega límites de entrada/salida, cancelación, bloqueo de redirecciones, saneamiento, autorización remota y costo camelRun. Alcance local/OpenAI-compatible conservado. |
| [#111](https://github.com/Victoriosas/autopilot/pull/111), [#125](https://github.com/Victoriosas/autopilot/pull/125) | Cerrar las PR documentales conflictivas después de preservar abajo sus hechos históricos. Sin eliminar ramas ni evidencias. Sus activaciones ya sucedieron, no son funcionalidad pendiente. |
| [#122](https://github.com/Victoriosas/autopilot/pull/122) | Conservar DRAFT: respuesta automática sobre consultas de precio, con conflictos. No adelantar autonomía respecto de revisión humana/conocimiento aprobado/evaluación completa. |
| [#124](https://github.com/Victoriosas/autopilot/pull/124) | Conservar DRAFT: agrega dos servicios al canon 17, cambia respuestas y propone otra coordinación de agentes. Revisar alcance/rescatar por piezas, sin descartar trabajo único. |
| [#90](https://github.com/Victoriosas/autopilot/pull/90) | Conservar DRAFT y activos editoriales; conflictos documentales y aprobación de perfiles/canales pendiente. Omnicanal no desplaza F1–F4. |

Estados finales y checks del lote: descripción de #187. Un cierre administrativo no borra código ni acredita que todos sus cambios se fusionaron. Checks antiguos solo prueban aquellos SHA.

Cierres ejecutados el 06/11/2026: #111, #125, #129 y #131 quedaron CLOSED, con motivo agregado a su descripción original y ramas/commits conservados. #90/#122/#124 siguen DRAFT, al igual que #169 tras esta revisión. #187 es el registro de cierre del lote, pendiente de sus checks finales antes de integrarse.

## Evidencia histórica rescatada de #111

Activación del 23/10/2026, con autorización específica: producción 0f5bbc66faeac1a03b3d0f9425a92bbf85e7bb6e, deployment dpl_6iRgD772FbLWaqbsUVY9y4SrzDmx. Config habilitada, privacidad consultation-v1, retención 30 días; checkout cerrado y admin anónimo 401. Caso sintético persistido y aviso aceptado por Resend; el aviso del formulario se clasificó SPAM en Gmail. No convertir aceptación en garantía de bandeja principal o lectura humana.

Retención horaria existente: no duplicar cron ni limpiar manualmente. Supabase Preview fallido se vinculaba al otro proyecto. No se reproduce canario/envío/cambio remoto para cerrar esta PR. Fuente original conservada: [PR111](https://github.com/Victoriosas/autopilot/pull/111), head 6f8c8cfaafce9a511e81d3dd31541c9b7d07ed1c.

## Evidencia histórica rescatada de #125

Lectura persistente publicada el 24/10/2026: PR123 integrada por autorización específica como 27558f3e6161c12c2df0ba23112262e56787f8c0; deployment dpl_AKzPuCTWWKnojvYPgVivR2Fjtks8 READY y dominio/SHA comprobados entonces. Campana, contador y marcas leída/no leída publicados. Smoke histórico: páginas 200, borradores 404, retiradas 410 y admin 401; sin escrituras de prueba sobre consultas reales.

Core [40063144560](https://github.com/Victoriosas/autopilot/actions/runs/40063144560), Beauty Auth/PostgREST [40063144568](https://github.com/Victoriosas/autopilot/actions/runs/40063144568) y CodeQL 40063144272 aprobados para aquella publicación. Migración individual 20261024040055 ya aplicada entonces al principal; no se reaplica. Fuente original: [PR125](https://github.com/Victoriosas/autopilot/pull/125), head 42da44279426d39a6f3d4054f6f67ceaf698ca69. La autorización de PR123 no autorizaba #122 ni nuevas respuestas automáticas.

Estos hechos fechados no afirman disponibilidad actual; la evidencia posterior del canario F1 del 04/11 está en [F1_RECEPCION_PRODUCTIVA_CONTROLADA_20261104.md](F1_RECEPCION_PRODUCTIVA_CONTROLADA_20261104.md).

## Fases, seguridad y continuidad

F1 supervisada tiene canario previo. F2 tiene 17 últimas descripciones aprobadas/vigentes y cero tarifas aprobadas según lectura del 05/11, con límites sobre protocolos y datos profesionales. F3 smoke real 3/3 + 6/6 es parcial: complete/gate false; no habilita F4 IA ni autonomía. No modificar el corpus 40+6 ni abrir los ocho finales por depurar PR.

Supabase Preview sigue omitida en PR y vinculada al histórico: [#180](https://github.com/Victoriosas/autopilot/issues/180). No equivale al stack Beauty real desechable aprobado. Mantener revisión de seguridad [#175](https://github.com/Victoriosas/autopilot/issues/175), RLS, retención y costos.

Trabajo en worktrees nuevos, sin reset/clean/stash/force-push, sin eliminar ramas/archivos ajenos. No se afirma sincronización global de PC. Rollback: PR de reversión; las cuatro PR históricas pueden reabrirse conservando head/ramas. Actualizar bibliotecas no acredita sus API remotas ni activa modelos.
