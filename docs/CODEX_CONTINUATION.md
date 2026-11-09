# Continuidad técnica de Codex

Este protocolo aplica la directiva V5 con las habilidades existentes. La dirección sigue en [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md), el historial en [AUTOPILOT_STATE.md](AUTOPILOT_STATE.md) y la orden recuperable en [CODEX_CONTINUATION.json](CODEX_CONTINUATION.json). El JSON registra una orden técnica a la vez y sus dependencias. Se actualiza únicamente ante un avance o bloqueo material mediante rama revisable.

## Recuperación y decisión

1. Leer AGENTS.md, la habilidad coordinadora, dirección y última entrada relevante del historial. Abrir el JSON y verificar su versión de esquema.
2. Contrastar rama, SHA completo, worktree, archivos modificados, procesos, remoto, PR y CI por SHA exacto. No escribir sobre trabajo concurrente o una base incierta. Una ruta de otra PC debe resolverse a un checkout autorizado antes de ejecutar.
3. Recuperar primero trabajo propio en ejecución, después resultados pendientes de prueba, correcciones demostradas, dependencias desbloqueadas y cola por F1–F4. Buscar PR equivalentes antes de crear otra.
4. Antes de repetir una operación, comprobar su evidencia y sus efectos. Una operación externa de resultado incierto requiere intervención. Conservar el último checkpoint válido si no se puede persistir el siguiente y comunicar el fallo.

## Ejecución, supervisión y nueva orden

El ejecutor registra objetivo, criterios, entorno, SHA, diff, comandos, pruebas, riesgos y pendientes. Luego el mismo Codex cambia a supervisor adversarial y realiza al menos una comprobación adicional del diff, una regresión o el SHA real de CI. Registra APROBADO, RECHAZADO, INCOMPLETO o BLOQUEADO con motivo. Esa revisión interna conserva las aprobaciones humanas exigidas por el proyecto.

El coordinador registra la siguiente orden con ID único, fase, objetivo, dependencias, entorno elegido, permisos, criterios medibles, evidencia e instrucción de reanudación. Continúa si existe trabajo seguro y capacidad. Ante bloqueo busca una tarea independiente. No repite pruebas válidas del mismo SHA sin motivo ni genera ciclos vacíos.

## Persistencia y coordinación

- `repository.head_sha` identifica el código contrastado al guardar, habitualmente el padre del commit documental. El commit que contiene el checkpoint se verifica con Git al recuperar. Una diferencia legítima se explica antes de actualizar referencias.
- `completed_operations` contiene efectos comprobados y cómo detectarlos. `evidence_refs` conserva rutas o enlaces recuperables sin secretos ni datos de clientas.
- Antes de publicar el checkpoint, volver a leer su versión remota y reconciliar cambios. Usar push normal, nunca force push. Una rama separada limita colisiones, pero ningún archivo local acredita exclusividad entre máquinas.
- Si un futuro runtime realiza escrituras compartidas, debe demostrar exclusión con expiración y protección frente a ejecutores obsoletos antes de habilitarlas. Este protocolo documental admite recuperación manual en un worktree propio.
- Registrar el checkpoint y el historial en la misma propuesta. Antes de cerrar, volver a leer el JSON desde otro proceso, comprobar referencias y estado Git. El siguiente ejecutor remoto necesita acceso al commit publicado de la rama.

## Reanudación externa

El 09/11/2026 se encontró la configuración local `victoriosa-autopilot-6h` en estado ACTIVE, con intervalo de seis horas. La configuración acredita intención de programación. Falta demostrar un arranque técnico que reciba esta rama, recupere su orden y evite colisiones. La recuperación manual del JSON solo prueba lectura persistente.

Para certificar reanudación desatendida, observar una ejecución del mecanismo existente, verificar recursos e instrucciones recibidos y realizar una recuperación inocua que solo lea la orden y reporte su ID/SHA. Conservar evidencia del run y comprobar ausencia de duplicados. Cualquier adaptación debe ser revisable y respetar permisos existentes. Si esa capacidad falta, registrar `unverified` y conservar la orden para una sesión autorizada.

## Cierre

Entregar entorno, rama y SHA, última orden, estado y resultado, evidencia, supervisión y veredicto, riesgos, siguiente orden y prioridad, entorno elegido, criterios de aceptación, checkpoint, estado de reanudación y causa de interrupción. Si falló la persistencia, explicitar qué parte quedó solo en la sesión.
