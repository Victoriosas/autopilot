# Coordinación ChatGPT Work ↔ Codex local

Última observación: 2026-11-10T01:02:31Z (09/11/2026 22:02:31 America/Montevideo).
Autor de esta observación: ChatGPT Work mediante GitHub y Desktop Commander Remote.
Estado: GITHUB_CONTRASTADO / HOST_OFFLINE / SESION_LOCAL_NO_IDENTIFICADA.
Este documento es un punto compartido de lectura y actualización manual; no sincroniza conversaciones, sesiones, configuraciones ni procesos automáticamente.

## Autoridad y alcance
Aplicar AGENTS.md, PROJECT_DIRECTION.md y SYNC_PC_GITHUB_SEGURO.md. Preservar AUTOPILOT_STATE.md y los checkpoints técnicos existentes; este archivo los enlaza, no los reemplaza.
La petición del propietario autoriza inventariar configuraciones relevantes en C:/, C:/Users/micahael/.codex, E:/ y ubicaciones relacionadas y publicar un resumen saneado. No autoriza publicar secretos, cambiar configuración global, activar servicios, detener sesiones o sobrescribir trabajo concurrente.
Codex construye Autopilot para transferir progresivamente ejecución, planificación y continuidad a componentes verificables; las pruebas sintéticas no acreditan operación general ni producción.

## Hechos contrastados en GitHub
Repositorio: Victoriosas/autopilot. Main: a6cff5aba04e752cb010926b88c24fd4abfe84b6.
Las propuestas siguientes permanecen en borrador; no tratar su código como integrado en main.

| Tramo | PR | SHA de referencia | Alcance |
| --- | --- | --- | --- |
| Recuperación/runner C, conserva B | [209](https://github.com/Victoriosas/autopilot/pull/209) | a6cdc0c1eecc13dde9b57a1c69c56c563fbbd33d | Ejecución y recuperación sintética |
| Planificador D | [210](https://github.com/Victoriosas/autopilot/pull/210) | 5403b2fa3067a76adb8601004ee24494b0f280a6 | Planificación/adaptación acotadas |
| CLI E | [211](https://github.com/Victoriosas/autopilot/pull/211) | ee34ef0501130b112e4023afb3cd1c8e04db8b05 | Operación manual de misiones |
| Disparadores F | [212](https://github.com/Victoriosas/autopilot/pull/212) | 0359fff114bff73e923678f10e2de16cda743e48 | Diagnóstico; sin transferencia operativa nueva |
| Host nativo G | [213](https://github.com/Victoriosas/autopilot/pull/213) | 15720289647da59c19cc2c19c7f123ee84259a31 | Lanzador preparado; activación pendiente |

ORD-204B preservada según evidencia de #209: 1b588f71f3194845f7f5a5e9287d436140a88464 en codex/mission-checkpoint-recovery-20261109.
V5 documental: [PR 205](https://github.com/Victoriosas/autopilot/pull/205), referencia 2a34b77f94d09cdacf4e88b141e912a898d99eef.
Verificar nuevamente PR, refs y CI por SHA antes de actuar. No atribuir CI de otro SHA o una regresión al funcionamiento del disparador.

## PC y sesión: límite de la evidencia
Ambas conexiones Desktop Commander Remote devolvieron micahael-PC OFFLINE, última conexión aproximada hace tres horas. No se inspeccionaron los discos, procesos, configuración ni sesión activa en esta auditoría.
PC apagada, acceso remoto desconectado y sesión de Codex inactiva son estados distintos. La evidencia disponible solo acredita falta de acceso remoto.

| Ubicación conocida | Procedencia | Estado en esta auditoría |
| --- | --- | --- |
| C:/autopilot | Documentación previa del checkout principal | No inspeccionado |
| C:/Users/micahael/.codex | Ruta indicada por propietario; configuración/sesiones | No inspeccionado |
| E:/ | Raíz indicada por propietario, worktrees históricos | No inspeccionado |
| C:/autopilot-worktrees/mission-native-host-20261109 | PR 213, checkout aprobado G | No inspeccionado |
| C:/autopilot-worktrees/mission-native-host-proposal-20261109 | PR 213, artefactos/checkpoints externos | No inspeccionado |
| /workspaces/autopilot-mission-recovery | Codespace histórico de B | Entorno distinto; no es ruta Windows |

Sesión local actual: ID desconocido; PID desconocido; cwd desconocido; modelo/perfil/MCP efectivos desconocidos. No afirmar emparejamiento completado.

## Autorización G: conservar alcance y tiempo
Según actualización operativa de PR 213: tarea registrada y DESHABILITADA; historial nativo habilitado; PostgreSQL dedicado detenido; misión pendiente de admisión. Son observaciones previas del operador, no lecturas actuales del host por Work.
Autorización existente: 10/11/2026 America/Montevideo, PostgreSQL 17:58–18:28; disparos nativos 18:00–18:20 cada dos minutos; misión synthetic-native-ord204g.
La preparación futura NO está automatizada. Requiere sesión real con acceso al host. No repetir solicitud de la misma autorización; no extender ni reprogramar la ventana vencida.
Cierre: retirar tarea, detener instancia dedicada, restaurar configuración previa del historial y conservar evidencia. No hay arranque ni recuperación automáticos observados.
No alterar el checkout/SHA aprobado ni su manifest para introducir este documento de coordinación.

## Inventario pendiente cuando se reconecte
1. Identificar host, hora/zona y procesos Codex relevantes (PID, padre, inicio, ejecutable; omitir argumentos sensibles).
2. Listar primero raíces C:/ y E:/; seguir solo repositorios, worktrees, configuraciones y respaldos pertinentes. Evitar escaneo recursivo indiscriminado de Windows, dependencias y datos personales.
3. Identificar .codex efectivo: raíz, nombres de archivos, perfiles, skills, proveedores/MCP por nombre y estado, configuración de automatizaciones por horario/cwd. Extraer en el host solo campos permitidos y hashes. No volcar auth.json, tokens, .env, bases de sesiones o logs completos.
4. Obtener git status, HEAD, remoto saneado, worktrees y ahead/behind de cada checkout relevante. Preservar cambios no rastreados. No reset/clean/stash/rebase ni cambios de rama sobre trabajo activo.
5. Correlacionar sesión con proceso/cwd y metadatos recientes del proyecto. Recencia por sí sola no prueba que una sesión esté activa; documentar confianza o ambigüedad. No publicar conversaciones privadas ni identificadores de sesiones si no son necesarios.
6. Comparar configuración global, de proyecto y efectiva; registrar diferencias y propuestas sin aplicar cambios de configuración.
7. Añadir una observación saneada aquí y en AUTOPILOT_STATE.md solo ante avance material, mediante rama/PR revisable. Vincular evidencia técnica por ruta o SHA, no copiar secretos.

## Contrato de intercambio
Cada observación debe indicar fecha UTC/zona, actor, fuente, host accesible o no, checkout/rama/SHA, estado de sesión (verificado/desconocido), orden, cambios concurrentes, evidencia, bloqueo y siguiente acción.
Antes de escribir, releer versión remota y comparar blob/commit; reconciliar cambios concurrentes. No usar force push. Un archivo en GitHub no es un lock, un canal de mensajes ni una garantía de que Codex ya lo haya leído.
Para consumir esta propuesta antes de fusionar: abrir el archivo desde su rama de coordinación, sin cambiar el checkout de ejecución ni fusionar automáticamente.
La confirmación del emparejamiento requiere que Codex local lea la misma versión y aporte su observación verificable. Hasta entonces: PENDIENTE.

## Próxima acción
Reconectar Desktop Commander Remote en micahael-PC y completar el inventario de solo lectura. No iniciar G fuera de su ventana ni activar OpenCode en paralelo.
