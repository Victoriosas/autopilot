# ORD-204G · Propuesta nativa de Windows, preparada sin activar

Base contrastada: PR #212, `0359fff114bff73e923678f10e2de16cda743e48`, main `a6cff5aba04e752cb010926b88c24fd4abfe84b6`. Rama aislada `codex/mission-native-host-20261109`, apilada sobre #212; conserva ORD-204B–F. Avance N2 sintético de preparación operativa, sin cambiar las puertas F1–F4. **Estado requerido: PREPARADO; arranque automático NO DEMOSTRADO.**

## Una propuesta para aprobar

Registrar una única tarea nativa `\Victoriosas-Autopilot-Synthetic-Demo`, inicialmente deshabilitada, bajo la cuenta actual, sin elevación, sin contraseña guardada. Una vez autorizada, habilitarla únicamente para el **10/11/2026, 18:00–18:20, America/Montevideo (UTC−03)**, cada **dos minutos**. Es una frecuencia propuesta para la demostración, no un cambio realizado ni un reemplazo del heartbeat de seis horas. No hay scheduler propio, prompt, Codex/OpenCode, servicio nuevo ni selección de objetivos.

Abrir una ventana separada de PostgreSQL dedicado de **17:58 a 18:28**, 30 minutos, sobre el directorio y puerto existentes. El controlador acotado inicia, espera y cierra esa instancia; no registra servicios. Si la fecha propuesta vence antes de aprobar, preparar otra fecha explícitamente acordada, nunca activar la tarea con una ventana pasada.

Recursos afectados: checkout `C:/autopilot-worktrees/mission-native-host-20261109`; artefactos/configuración/evidencia `C:/autopilot-worktrees/mission-native-host-proposal-20261109`; datos PostgreSQL `C:/autopilot-worktrees/queue-fencing-20261109-pg`; loopback IPv4 `127.0.0.1:55439`; base `victoriosa_mission_operator_lab`; semilla/worktrees existentes bajo `C:/autopilot-worktrees/mission-operator-lab-20261109`. No se usa el servicio PostgreSQL ajeno ni se expone la base a la red.

## Código y configuración

- [Lanzador](../scripts/autopilot-native-host.ts) y [política del host](../src/autopilot/nativeHost.ts): ejecutan directamente Node/CLI mediante argumentos fijos, sin shell o comandos del payload. Solo `synthetic-native-ord204g`.
- [XML importable deshabilitado](../tools/native-host/task.disabled.xml): `InteractiveToken`, `LeastPrivilege`, `IgnoreNew`, límite nativo dos minutos, sin reintentos propios, sin catch-up, sin wake ni trigger de arranque. La tarea no está registrada.
- [Preparador](../tools/native-host/Prepare-NativeDemo.ps1): genera manifest con SHA exacto y hash de configuración, copia de ejecución y XML deshabilitado; valida con COM nativo sin registrar. No inicia infraestructura ni admite misiones. Rechaza sobrescribir su directorio de propuesta.
- [Configuración de ejecución](../tools/native-host/execution-host.json): `admit:false, execute:true, cancel:false`, mismos recursos/base/binding de E; lease 15 s, plazo de misión 12 s, consultas 2 s. Credenciales exclusivamente del host; sin passwords en archivo, argumentos o evidencia.
- [Solicitud fija](../tools/native-host/mission-request.json): objetivo estructurado sin plan. **Todavía NO admitida en la PC**, porque no se autorizó iniciar la base. Debe admitirse separadamente antes de habilitar la tarea; el lanzador falla cerrado si no existe o no tiene el binding autorizado. El lanzador no puede admitir, cancelar ni inicializar.
- [Origen nativo](../tools/native-host/Read-TaskOrigin.ps1): exige evento 129 real del canal operativo, nombre exacto y PID del lanzador en los últimos dos minutos. Registra RecordId, tiempo, usuario y SID. No inventa TaskInstanceId: el esquema nativo de evento 129 inspeccionado contiene TaskName/Path/ProcessID/Priority, sin GUID de instancia.
- [Ventana del laboratorio](../tools/native-host/Demo-LabWindow.ps1): acciones `Window`, `Check`, `Stop`; iniciar/parar requiere `-ApprovedWindow`. Directorio/puerto fijos; inicio solo si la instancia dedicada está detenida. Fuerza `listen_addresses=127.0.0.1`. No toca servicios ni instala arranque al reiniciar.

El lanzador verifica identidad de su checkout, commit completo aprobado, archivos tracked sin cambios y ausencia de archivos untracked no ignorados; archivos/rutas canónicos, hash de configuración, permisos de ejecución exclusiva, directorios de recursos y commit semilla. Congela la configuración validada en una copia por invocación; consulta la CLI para comprobar base/marcador/binding y misión antes de ejecutar. Node debe coincidir con el binario del propio lanzador. Git/psql son binarios del host confiado, no una garantía de integridad del sistema operativo o de node_modules. El host y sus dependencias deben permanecer bajo control del propietario.

No hay selección sobre una cola nueva: status y run siempre usan el mismo ID fijo. Busy sale 3; backoff sale 4; presupuesto agotado o cierre no satisfactorio sale 5; rechazo/error sale 2. Exit 0 también puede representar una misión ya cerrada: inspeccionar outcome/reason, no inferir objetivo completado del exit code. Se preservan claim atómico y fencing, intentos y backoff existentes. Una tarea running expirada y agotada alcanza la función SQL existente para cerrar blocked; una misión terminada no se reactiva.

IgnoreNew controla solapamientos de esa tarea; reclamaciones SQL siguen resolviendo carreras con otra invocación manual. No se añade mutex con archivos que pudiera quedar bloqueado tras un crash. El plazo global del lanzador es 45 s, con aborto y cierre de hijos mediante ManagedProcesses; el scheduler tiene un techo adicional de dos minutos. Una terminación forzada por Windows o una pérdida de energía no garantiza ejecutar finally ni matar instantáneamente todos los descendientes. Se mantienen lease, timeout SQL y reconciliación; no se extiende fencing SQL a filesystem.

## Identidad y disponibilidad: documentado frente a probado

Inventario Windows actual: servicio `Schedule` Running/Automatic, sin tarea del proyecto encontrada por la búsqueda de nombres; cuenta `micahael-pc/micahael`, SID `S-1-5-21-407708465-2732056728-3733312173-1000`; token actual **no elevado**. El XML usa ese SID y el preparador vuelve a leer el SID actual. No se crean usuarios, credenciales ni permisos de red. Coste externo previsto: ninguno; utiliza PC/instancia local existentes, sin servicios pagos. No se midió coste eléctrico.

El canal `Microsoft-Windows-TaskScheduler/Operational` está **deshabilitado**. La propuesta incluye habilitarlo para la ventana y restaurarlo a su estado deshabilitado al terminar, sin borrar eventos. Puede requerir intervención administrativa específica del propietario para ese cambio; la tarea continúa con privilegios mínimos. Si no se puede leer un evento nativo inequívoco, `--native` se rechaza. Pasar `--native` manualmente no acredita origen.

Con `InteractiveToken`, Microsoft exige una sesión del usuario ya iniciada: cerrar Codex no impide por diseño el arranque, pero cerrar sesión sí. Una sesión bloqueada sigue siendo una sesión existente; no se ha demostrado aquí su ejecución. PC suspendida: WakeToRun=false no solicita despertarla. StartWhenAvailable=false no pide recuperar horarios perdidos. Tras reinicio no hay trigger de boot ni inicio automático de este PostgreSQL; requiere sesión y laboratorio disponible dentro de la ventana. No se garantiza funcionamiento desconectado, tras reinicio ni permanente. Fuentes: [tipo de logon](https://learn.microsoft.com/en-us/windows/win32/taskschd/principal-logontype), [WakeToRun](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-waketorun), [StartWhenAvailable](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable), [solapamientos](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-multipleinstances).

La cuenta local conserva sus privilegios reales sobre el host y el propietario PostgreSQL del laboratorio. Los flags de configuración limitan esta entrada, no convierten esa cuenta en un usuario OS/SQL con permisos mínimos nuevos. La autenticación local preexistente del laboratorio es trust en loopback; no se amplía ni se cambia. No es una frontera contra otros procesos hostiles de la misma PC. No se presentan nombres de ejecutor o IDs de tarea como autenticación de solicitantes.

## Preparación reproducible, sin instalar

Estos pasos solo generan artefactos y validan la definición; se pueden revisar antes de cualquier aprobación operativa. El SHA del manifest debe coincidir con el SHA final de la PR entregada, no con una rama móvil.

```powershell
Set-Location 'C:/autopilot-worktrees/mission-native-host-20261109'
$approvedSha = (git rev-parse HEAD).Trim()
& ./tools/native-host/Prepare-NativeDemo.ps1 -ApprovedSha $approvedSha -StartAt '2026-11-10T18:00:00-03:00'
$proposal = 'C:/autopilot-worktrees/mission-native-host-proposal-20261109'
Get-Content "$proposal/manifest.json"
```

El preparador no modifica configuraciones globales ni políticas de ejecución de PowerShell. No usar ExecutionPolicy Bypass para eludir una política del host. El directorio es externo al checkout; conserva evidencia y no se añade a Git. Repetir preparación exige escoger/revisar conscientemente un respaldo del directorio existente; no se borra por automatismo.

## Comandos operativos propuestos: requieren aprobación, NO ejecutados

1. Antes de la ventana, habilitar únicamente el historial nativo (si el propietario autoriza la operación administrativa) e importar la tarea **todavía deshabilitada**, rechazando nombres existentes:

```powershell
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
$proposal = 'C:/autopilot-worktrees/mission-native-host-proposal-20261109'
if (Get-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo' -ErrorAction SilentlyContinue) { throw 'task_already_exists' }
Register-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo' -Xml (Get-Content "$proposal/task.disabled.xml" -Raw)
```

2. A las 17:58, en una terminal que permanezca abierta, iniciar el controlador de 30 minutos:

```powershell
Set-Location 'C:/autopilot-worktrees/mission-native-host-20261109'
& ./tools/native-host/Demo-LabWindow.ps1 -Action Window -ApprovedWindow
```

El controlador cierra PostgreSQL en finally al acabar o ante una interrupción capturable. No se instala ni se oculta como servicio. Si se pierde por fuerza, suspensión/reinicio u otro fallo que impida finally, **el cierre queda pendiente del operador** mediante Stop, y debe comprobarse. No se garantiza disponibilidad o cierre puntual con la PC apagada/suspendida. No habilitar ni cambiar suspensión del sistema por iniciativa propia.

3. En otra terminal, con esa instancia disponible, comprobarla, admitir el objetivo separado y verificar su estado antes de habilitar:

```powershell
Set-Location 'C:/autopilot-worktrees/mission-native-host-20261109'
& ./tools/native-host/Demo-LabWindow.ps1 -Action Check
$ownerHost = 'C:/autopilot-worktrees/mission-operator-lab-20261109/host.json'
node --import tsx scripts/autopilot-mission.ts admit --config $ownerHost --request tools/native-host/mission-request.json
node --import tsx scripts/autopilot-mission.ts status --config $ownerHost --id synthetic-native-ord204g
# Habilitar solo después de confirmar queued y la ventana/SHA aprobados.
Enable-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo'
```

La admisión idéntica es idempotente; si el ID ya está cerrado, no borrarlo ni reactivarlo para fabricar una nueva prueba. Revisar el conflicto y preparar otra orden explícita. No ejecutar `Start-ScheduledTask`, ni lanzar el segundo run desde el arnés y atribuírselo al reloj. Estos comandos tampoco cambian el heartbeat de Codex.

## Observación y correlación pendiente

Cada invocación crea JSONL propio con invocationId, PID del lanzador, SHA, missionId y origen. Los eventos process_started/ended guardan PID de la CLI. El runId/claimed se guarda mientras llega stdout, antes de que termine el hijo, también si este muere después. No se guarda stdout completo, token, credencial, comando de payload ni contenido de objetivo. Las copias de configuración no aceptan secretos. Es evidencia local con flush a disco, no almacenamiento inmutable contra el propietario del host.

Cadena que deberá contrastarse: **evento 129 RecordId/TaskName/ProcessID → launcherPid/invocationId → PID cli_run → runId → missionId → claim y auditoría SQL**. `manual:true` de la CLI describe su entrada de E; no se modifica para simular automatismo. Solo el origen nativo validado por el nuevo lanzador puede atribuir el arranque a Windows. Las invocaciones `--manual` se registran expresamente como manuales y nunca prueban el disparador.

Prueba pendiente: antes del primer horario, preparar observación/instrumentación de una espera después del efecto y antes del checkpoint, sin dar plan ni reparación. Primer evento nativo inicia la misión; el observador mata solo el PID de CLI identificado. Guardar su runId y auditoría sin divulgar tokens. Retirar la espera de observación, dejar vencer naturalmente el lease de 15 s y **esperar el siguiente disparo normal de dos minutos**, sin relanzar. Comprobar intento nuevo, mismo plan/checkpoint, efectos reconciliados sin reescritura y rechazo de las escrituras con el token anterior. Después, probar duplicados/contención, cancelación y presupuesto agotado con la misma entrada. Esta orden prepara el circuito: todavía no se ejecutó ni se atribuye una recuperación automática a pruebas manuales/CI.

## Deshabilitación y retirada propuestas

Deshabilitar primero; cancelar de forma durable si la misión sigue activa, observar cierre y detener tarea si fuera necesario. Solo retirar la tarea creada por esta propuesta, sin afectar tareas ajenas. Conservar worktrees, base y evidencias.

```powershell
Disable-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo'
Set-Location 'C:/autopilot-worktrees/mission-native-host-20261109'
node --import tsx scripts/autopilot-mission.ts cancel --config 'C:/autopilot-worktrees/mission-operator-lab-20261109/host.json' --id synthetic-native-ord204g
Stop-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo'
Unregister-ScheduledTask -TaskName 'Victoriosas-Autopilot-Synthetic-Demo' -Confirm:$false
& ./tools/native-host/Demo-LabWindow.ps1 -Action Stop -ApprovedWindow
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:false
```

Restaurar el historial a false solo porque ese fue su estado medido antes de esta propuesta y únicamente si nadie lo cambió por otra finalidad. No vaciar eventos. Stop actúa exclusivamente sobre el directorio PostgreSQL dedicado; si ya está detenido informa fallo de parada sin tocar otro servicio. Confirmar `pg_ctl status` y ausencia de task antes de cerrar la ventana. No eliminar archivos como supuesto rollback de efectos de misión.

## Validación y límites de la entrega

El XML fue aceptado por el parser COM de Windows como deshabilitado, sin RegisterTask; scripts PowerShell analizados con el parser nativo. El canal operativo no se habilitó y PostgreSQL siguió detenido. Pruebas unitarias cubren alcance fijo, campos/permisos no admitidos, duración, terminal/busy/backoff/presupuesto y observación de stdout antes de la pérdida del hijo. El job postgres existente incorpora una invocación **manual** del mismo lanzador con admisión real en base desechable, cierre completado, repetición terminal y rechazo del hash alterado. Esa prueba no usa origen nativo ni registra tareas.

Resultados de verify, pruebas manuales negativas del host, regresiones C/D/E, CI por SHA final y cero Preview se registran en el cierre/PR. No se afirma una prueba positiva Windows con base detenida. La revisión adversarial adicional considera falsificación de origen por flag, cambios de configuración entre preflight/CLI (copia congelada), pérdida antes de guardar runId (observación incremental), permisos del host, carreras de claim y cleanup tras un kill forzado. La correlación nativa y el comportamiento bajo reinicio/suspensión permanecen sin demostrar.

**Transferencia preparada:** inicio directo por el sistema operativo sin sesión de Codex/OpenCode y sin decisiones entre pasos. **Transferencia operativa aún no demostrada:** se requiere aprobar registro/historial, disponibilidad/admisión y la ventana anterior, y observar dos eventos reales. Permanecen preparación del host, aprobación de recursos y manejo de fallos fuera de esa ventana. Sin modelos remotos, planificación general, independencia completa, funcionamiento permanente, producción, SQL alojado, gastos, credenciales nuevas, envíos o auto-merge.
