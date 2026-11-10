# Coordinación ChatGPT Work ↔ Codex local

Última observación: 2026-11-10T01:10:46.9310853Z (09/11/2026 22:10:46 America/Montevideo).
Autor de esta observación: ChatGPT Work mediante GitHub y Desktop Commander Remote.
Estado: GITHUB_Y_HOST_CONTRASTADOS / SESION_CANDIDATA_IDENTIFICADA / ACUSE_CODEX_PENDIENTE.
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

## PC y sesión: observación inicial, superada por el inventario al final
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

## Procedimiento de inventario y repetición segura
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
Codex local debe leer esta misma versión y confirmar cwd/HEAD/huella del inventario. No iniciar G fuera de su ventana ni activar OpenCode en paralelo.


## Inventario real del host · 09/11/2026 22:05–22:10 Uruguay

Fuente: Desktop Commander Remote en micahael-PC, PowerShell y Python locales; SQLite abierto con mode=ro y query_only. Se consultaron metadatos de sesiones y únicamente campos de configuración permitidos. No se leyeron auth.json, .env ni almacenes de secretos; no se exportaron conversaciones.

### Sesión y configuración
La sesión candidata más reciente del proyecto tiene cwd C:/autopilot, huella de ID a6bf13d814ef8e47 y última actualización de rollout 10/11 00:56:21 UTC. El último turn_context observado confirma gpt-6.1-sol, esfuerzo medium, aprobación never y danger-full-access. CLI registrada: 0.167.0-alpha.3.2.
Son metadatos de una sesión reciente, no una prueba de turno actualmente ejecutándose ni de correspondencia exclusiva con un PID. No se ha recibido acuse de Codex local leyendo este archivo.
Procesos observados: Codex app-server PID 14728 y modo exec PID 12088. OpenCode PID 15000 en modo serve; servidor abierto no demuestra edición concurrente. No se detuvo ni lanzó ningún agente.
Global config.toml: SHA256 326e388a92e8dc77743e2bd1c3a34f212dd74760efa9dc76d7069c45ece7f1f6. Configuración del proyecto .codex/config.toml solo define approval_policy=never; no selecciona otro modelo. Hay 13 habilidades de proyecto; globales .system y playwright. Los MCP listados en el JSON adjunto están configurados, no probados como conectados.

### Discrepancias que requieren reconciliación
- C:/Users/micahael/.codex/AGENTS.md todavía presenta un director de tienda Victoriosa.click, ecommerce y crecimiento comercial; las instrucciones del repositorio definen Victoriosas.online estética/Autopilot y prohíben reintroducir comercio. SHA256 global 5959807f2a8c09d4a0b554e11b5737eec1f0e99734e9a035a4cd9fea90d2d9dc. No se modificó. Para este repositorio respetar la dirección actual y revisar el alcance global sin perjudicar otros proyectos.
- C:/autopilot-worktrees/INSTRUCCIONES.md describe worktrees y base de octubre; es histórico, no inventario vigente.
- Heartbeat ACTIVE cada seis horas: configuración sin cambios, último modelo de su hilo gpt-6-luna; distinto de la sesión interactiva. Su prompt menciona dominios antiguo y actual y no contiene mission:local. No es un disparador directo de la CLI.
- C:/autopilot está en codex/workspace-main-20261108, HEAD igual a main remoto a6cff5a completo, cero cambios versionados y 138 entradas untracked en modo normal. No es árbol limpio. No se movieron, ocultaron, borraron ni agregaron esas entradas.
- 50 worktrees registrados, uno marcado prunable. Se observaron cambios versionados en diseno, glm53-opencode-20261031, consultation-ai-circuit y consultation-phase2; se conservaron. No se podó ningún worktree.

### Código, respaldo y alcance del cotejo
Los worktrees B–G pertinentes y los cuatro de E:/ fueron contrastados por HEAD/status; los SHA principales constan en [el inventario estructurado](WORK_CODEX_HOST_INVENTORY.json).
ORD-204B está confirmada como rama remota con SHA 1b588f71f3194845f7f5a5e9287d436140a88464.
Se encontró además un worktree limpio C:/autopilot-worktrees/mission-native-activation-20261109, commit documental bd24d4c8efde7ec24efea05b949b6fb0c8814021. La rama por ese nombre exacto no apareció en ls-remote. Preservarla; eso no demuestra ausencia del objeto o contenido en todas las refs remotas.
Existen C:/autopilot-backups y E:/Victoriosas_Recovery_20261108. El informe de recuperación de 08/11 registra 256 archivos preservados con SHA256. Se verificó existencia del informe, manifest y carpeta; no se recalculó la integridad de todas las copias. E:/AI_Cache_Archive es caché y no acredita un respaldo del código.
Se inspeccionaron estructura/campos permitidos de configuración OpenCode, VS Code MCP y .codex/environments; no se aplicó su setup/cleanup ni se activaron conectores.

### Estado G comprobado
Tarea Victoriosas-Autopilot-Synthetic-Demo: Disabled, enabled=false, RunLevel Limited, LastTaskResult 267011, próximo horario 10/11 18:00 Uruguay. No se observaron listeners 55439/55441; RESUME_WINDOW_RULES y ACTIVATION_CHECKPOINT conservan stopped/false y la autorización ya registrada. Esto no inventaría todos los servidores PostgreSQL del equipo.
Checkout G limpio en 15720289647da59c19cc2c19c7f123ee84259a31. No se cambió su contenido, manifest, configuración, tarea, horarios, historial ni servicios.

### Entrega y acuse
Propuesta en PR #214, rama codex/shared-context-20261110; no fusionada. Se entrega copia externa a los checkouts en C:/autopilot-worktrees/work-codex-coordination-20261110/.
Codex debe leer WORK_CODEX_SHARED_CONTEXT.md y WORK_CODEX_HOST_INVENTORY.json, contrastar fecha/cwd/HEAD y confirmar lectura con su propia observación. Sin acuse no afirmar memorias sincronizadas ni emparejamiento de sesión completado. Las configuraciones con permisos distintos se documentan; no se copian entre Work y Codex.
