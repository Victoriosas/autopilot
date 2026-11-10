# ORD-204G · ventana nativa observada, recuperación pendiente

## Resultado

El 10/11/2026 se observó **arranque directo desde el Programador de tareas de Windows**, sin una sesión de Codex interpretando pasos ni iniciando la CLI. Se observó después un segundo disparo nativo, pero falló antes de registrar otro claim. **Recuperación automática NO demostrada.** No se relanzó manualmente ni se reprogramó el horario para atribuir un éxito artificial.

Autorización previa: PR #213 y reglas locales `RESUME_WINDOW_RULES.json`. Runtime aprobado `15720289647da59c19cc2c19c7f123ee84259a31`, intacto/limpio. La sesión retomó a las 18:12 Uruguay, dentro de la ventana pero después de la preparación propuesta de 17:58. No hubo preparación automática. Se verificaron SHA, hash de configuración, tarea, identidad Interactive/Limited, historial y ausencia de otro proceso de misión antes de iniciar el laboratorio dedicado.

## Línea temporal, Uruguay (UTC−03)

| Momento | Evidencia |
|---|---|
| 18:14 | PostgreSQL dedicado iniciado en 127.0.0.1:55439 y verificado; misión `synthetic-native-ord204g` admitida y `queued`. |
| 18:15:54 | Tarea existente habilitada; horarios originales de dos minutos y fin 18:20 preservados. Sin Start-ScheduledTask. |
| 18:16:01.531 | Evento 129, RecordId **2076**, launcher PID **9232**; origen nativo validado por el lanzador. |
| 18:16:05 | Run **7d867315-09cc-4d97-a4d3-da64023896d9**, un claim; plan v1 y checkpoint 2 guardados. |
| 18:16:06.916 | Observador mata únicamente la CLI PID **3472**, después de ambos efectos y antes de checkpoint de modify-v1. |
| 18:16:26 | Espera inyectada retirada y función original restaurada; lease vencido naturalmente, escritura con token antiguo rechazada. |
| 18:16:37 | Estado leído: in_progress, intento 1, plan 1, checkpoint 2, leaseActive=false; admisión idéntica devuelve duplicate. |
| 18:18:00.536 | Segundo evento 129, RecordId **2082**, launcher PID **15672**. Termina código 2 antes de nueva evidencia durable/claim. |
| 18:20:27 | Ventana de disparos terminada, sin NextRunTime; sigue un solo intento. No se observó tercer disparo en el límite 18:20. |
| 18:20:48–18:20:59 | Tarea deshabilitada/exportada/retirada, misión cancelada duraderamente, función de checkpoint original verificada y PostgreSQL detenido; cero listeners. |

La invocación inicial fue **061dbb2c-245f-42af-b48f-808ad55068a0**. El ledger conserva objetivo y plan; el estado final es `cancelled`, motivo `cancelled_by_operator`, checkpoint 3, plan 1, intento 1. Los artefactos y registros se conservaron; no se borró la misión ni se la reactivó para repetir la prueba.

## Instrumentación y alcance

Un observador finito externo al checkout aprobado instaló una espera SQL temporal, limitada al ID autorizado y al checkpoint posterior al efecto. No suministró plan, reparación ni checkpoint. Identificó la CLI a través de la evidencia del lanzador con origen Windows, guardó metadatos/mtime, la interrumpió realmente y restauró la función. El token antiguo permaneció en memoria del observador, no en documentos ni logs.

El controlador PostgreSQL aprobado se inició tarde y se interrumpió mediante Ctrl+C a las 18:20:48; su finally cerró la instancia. No se dejó su espera de treinta minutos prolongar la disponibilidad fuera de 18:28. No hubo servicio nuevo ni modificación de suspensión, reinicio, scheduler o credenciales. El puerto ajeno y el servicio PostgreSQL ajeno no se tocaron.

La cancelación al cerrar y la admisión duplicada están probadas en esta ventana. Contención/budgets/negativos previos conservan su evidencia de E/G; **no se afirma que se hayan vuelto a demostrar mediante dos ejecutores nativos en esta ventana**. Tampoco se demostró reconciliación por un segundo ejecutor: no hubo segundo claim.

## Bloqueo y cierre

El segundo proceso terminó antes de abrir su JSONL; `LastTaskResult=2` y el evento 201 registran el fallo, pero no identifican el preflight exacto. SHA/configuración/checkout siguieron coincidiendo. La lectura posterior del evento de origen del PID 15672 funcionó; eso no demuestra qué ocurrió durante su arranque. No se atribuye la causa a Windows, base, archivos o permisos sin evidencia suficiente.

El siguiente cambio seguro es persistir un diagnóstico saneado de fallos tempranos fuera del candidato, revisar el rechazo y probarlo en aislamiento. Repetir el circuito operativo requerirá **otra ventana específica** y una misión autorizada que no reactive el ID cancelado. No se instala ni habilita nada por este documento.

El cierre del historial operativo requiere elevación normal de Windows: la llamada sin elevar devolvió Access denied, exit 5. Se solicitó la elevación normal ya autorizada; el resultado actual y su hora quedan en `ORD204G_NATIVE_WINDOW_RESULT_20261110.json`. No confundir PostgreSQL detenido/tarea retirada con historial restaurado hasta observar el valor false.

## Evidencia y clasificación

Evidencia completa local: `C:/autopilot-worktrees/mission-native-host-proposal-20261109/` contiene `NATIVE_INTERRUPTION_20261110.json`, `BEFORE_NATIVE_RECOVERY_20261110.json`, `AFTER_NATIVE_RECOVERY_20261110.json`, `CLOSED_MISSION_20261110.json`, `NATIVE_EVENTS_20261110.json`, `task.closed.disabled.xml`, `WINDOW_RESULT_20261110.json` y los JSONL del lanzador. Los eventos completos con identidad del host permanecen locales; el resumen publicado omite SID/usuario y tokens.

| Capacidad | Estado observado |
|---|---|
| Preparación de infraestructura/admisión | Manual por Codex dentro de la ventana |
| Arranque automático mediante Codex | No usado |
| Arranque directo de Autopilot por Windows | Sí, primer disparo validado |
| Segundo disparo nativo | Sí, terminó con error temprano |
| Recuperación automática | No demostrada |
| Independencia de PC, sesión o base disponible | No demostrada; siguen siendo dependencias |
| Funcionamiento permanente | No demostrado ni activado |

Esta entrega solo documenta la operación autorizada; no modifica el runtime aprobado ni sustituye la PR #213. La PR #218 de autodesarrollo F1 terminó aparte con verify 480/480 y CI validate/postgres/Beauty/navegador aprobadas, sin despliegues.
