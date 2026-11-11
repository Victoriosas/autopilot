# ORD204G_TEST_WINDOW_MANAGER

El gestor lee el reloj y la zona de Windows, el estado de la tarea, los procesos relevantes y el puerto dedicado. Opera sobre un archivo local `ORD204G_CONTINUITY_STATE.json` guardado fuera del checkout y protegido por la identidad del operador. La PR #220 y su SHA operativo son independientes de la rama del gestor. La autorización registrada requiere una decisión del propietario para el horario y los recursos concretos.

```powershell
node --import tsx scripts/ord204g-test-window-manager.ts check $stateFile
node --import tsx scripts/ord204g-test-window-manager.ts prepare $stateFile
node --import tsx scripts/ord204g-test-window-manager.ts propose $stateFile $retryEvidenceFile
```

- `check` vuelve a leer el host. La salida separa el estado temporal, la autorización y la preparación de cada ventana. Un reloj ambiguo, una consulta fallida o un recurso ocupado bloquean la selección.
- `prepare` verifica SHA y limpieza del checkout aprobado, reconcilia la reserva deshabilitada y valida o genera una propuesta deshabilitada. Los archivos se preparan antes de la ventana. El comando no registra ni habilita tareas.
- `propose` reutiliza una ventana disponible. Si hace falta otra, requiere un expediente nuevo con `reason`, `evidenceSha256`, `finding` y `correction`. El inventario conserva hasta tres propuestas además de la inicial y rechaza solapamientos o expedientes repetidos. El candidato conserva la hora local de apertura y queda pendiente de autorización.
- El operador registra `ACTIVE`, `CLOSING`, `CLOSED`, `EXPIRED` o `BLOCKED` después de reconciliar Windows, el ledger y los procesos. El gestor serializa escrituras y no toma el estado local como prueba de ejecución. Si un cierre forzado deja el archivo `.lock`, verificar que el escritor terminó antes de retirarlo.

## Ventana autorizada del 11/11/2026

Horario de Uruguay. Apertura 17:58, primer disparo 18:00, segundo 18:02, repetición cada dos minutos, último disparo esperado 18:18, límite de disparos 18:20 y cierre antes de 18:28. Usar el checkout limpio de PR #220 en `633faa7f9517a6d6edc82158cd125b09a66f6312`. El precheck previo observó el XML operativo registrado y deshabilitado, historial disponible y puerto 55439 libre.

1. Al abrir la ventana, repetir el precheck con el reloj real. Comparar el XML registrado con la propuesta, incluido SID local sin copiarlo a evidencia, comando, argumentos, working directory, cadencia, límites y políticas. Comprobar tiempo de preparación y cierre, espacio y ausencia de otros ejecutores.
2. Iniciar el PostgreSQL dedicado con el controlador del SHA aprobado y `CloseAt` absoluto. Verificar loopback, data directory y binding. Consultar el ledger existente antes de admitir la nueva solicitud sintética. Exigir `queued`, intento cero, presupuesto de dos o más y ausencia de artefactos previos. La misión cancelada anterior permanece excluida.
3. Desde el checkout del gestor, ejecutar el observador con el archivo de estado local y el valor exacto de `opensAt`. Esperar `observer_ready` y confirmar su archivo. Habilitar la tarea solo si continúa dentro de la ventana y queda margen para ambos disparos y el cierre.

```powershell
node --import tsx scripts/observe-ord204g-native-window.ts $stateFile '2026-11-11T17:58:00-03:00'
```

El observador añade un trigger temporal limitado al primer checkpoint de modificación de la nueva misión. Verifica la instancia, el binding, la hora y el proceso hijo asociado al evento 129. Interrumpe la CLI, guarda hashes y tiempos de ambos artefactos, retira el trigger y espera la expiración natural antes de comprobar el fencing. La espera del trigger caduca en SQL aun si el observador termina abruptamente. El observador no modifica el plan ni inicia un lanzador. Si falla, conservar la causa y verificar que el trigger se retiró antes de declarar cerrado.

4. Dejar que Windows dispare el segundo lanzador. Guardar ambos RecordIds, PID, UUID, runId y los claims SQL. Comparar hashes y tiempos de modificación contra `observer-interruption.json`, verificar plan, checkpoint final, resultado y ausencia de duplicación. Correlacionar un rechazo con su `.preflight.jsonl`. Una invocación manual, una prueba de CI o el hook aislado no acreditan recuperación nativa.
5. En `finally`, deshabilitar y verificar la tarea, retirar la tarea temporal si corresponde, cerrar solo procesos del laboratorio, cancelar duraderamente si quedó activa, verificar que el trigger y su función temporal desaparecieron y detener la instancia dedicada. Confirmar puerto libre y conservar evidencia. El historial ya estaba habilitado antes del precheck. Registrar cualquier restauración autorizada y su resultado.
