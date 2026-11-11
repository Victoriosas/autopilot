# ORD-204G · Puente GitHub → camelRun en solo lectura

Estado: **implementado y probado en dry-run**, sin despliegue continuo ni activación de Windows. Fase interna de ingeniería; no altera las fases clínicas/comerciales.

## Contrato y fronteras

- GitHub: usa únicamente HTTPS `GET` público de metadatos de la PR #220 y rutas de archivos. **No utiliza ningún token GitHub** ni ofrece API de escritura. Rechaza cabeza diferente de `633faa7f9517a6d6edc82158cd125b09a66f6312`, PR que deje de ser borrador, repositorio incorrecto o más de 100 archivos.
- Agente: `victoriosas_ord204g_engineering_guarded_v2` del tenant `victoriosas`. Antes de un envío real exige presupuesto acumulado USD 0,02, máximo dos respuestas/90 segundos, cero mounts, cero herramientas externas y ningún acceso de escritura por archivos. Cada llamada limita modelo a USD 0,003. Un gasto de modelos limitado **no garantiza** costo total cero: tiempo y almacenamiento siguen la política de camelRun.
- Datos: exclusivamente metadatos de la PR y nombres de archivos. Sin diffs, contenido de código, clientes, secretos, pruebas nativas o archivos Windows.
- Salida: JSON estricto con `actions_executed=[]`, `external_access=false` y verdict explícito. Un resultado asincrónico/no terminado NO se presenta como verificado.
- Ningún servicio, tarea programada, disparo nativo, admisión de misión, Git push, merge o despliegue se ejecuta desde este puente.

## Uso y pruebas

```powershell
node --test tools/camelrun-bridge/bridge.test.mjs
node --use-system-ca tools/camelrun-bridge/bridge.mjs
```

La opción `--use-system-ca` es necesaria en el Windows observado: `fetch` de Node falló por la ruta de certificados, mientras que las consultas HTTPS del sistema funcionaron. No usar `NODE_TLS_REJECT_UNAUTHORIZED=0` ni desactivar TLS.

Para la acción de análisis remoto, una persona autorizada debe configurar `CAMELAI_API_KEY` **en el gestor de secretos del entorno de ejecución** (nunca en Git, terminal compartida ni archivo de texto). El workflow manual preparado acepta el secreto de GitHub `CAMELAI_API_KEY` y exige seleccionar modo live. No está configurado dicho secreto ni hay ejecuciones automáticas. También puede lanzarse localmente con una variable de entorno gestionada de forma segura:

```powershell
node --use-system-ca tools/camelrun-bridge/bridge.mjs --live
```

**No iniciar live** sin comprobar primero límites, saldo de camelRun y validez del token configurado. La ejecución anterior validada con el conector viki demostró el circuito manual; este script nuevo solo se ha comprobado en dry-run y mediante mocks.

## Evidencia local (10/11/2026)

- PC `micahael-PC`: conexión Desktop Commander comprobada. Worktree origen del PR: SHA `633faa7f9517a6d6edc82158cd125b09a66f6312`, limpio al inspeccionar.
- Servicio `Schedule`: Running/Automatic. Canal `Microsoft-Windows-TaskScheduler/Operational`: enabled=true.
- `Victoriosas-Autopilot-Synthetic-Demo`: **Disabled**; próxima activación nominal en configuración a las 18:00 del 11/11/2026 (Uruguay), pero una tarea deshabilitada **no se dispara**. `LastRunTime` observado no demuestra ejecución; `LastTaskResult=267011`, sin interpretación causal concluyente.
- `127.0.0.1:55439` no figura escuchando; existen otros procesos `postgres` ajenos que NO se deben interrumpir.
- Recuperación real no demostrada; requiere ventana autorizada, SHA, configuración revisada y evidencia evento 129 → PID → claim → checkpoint → terminal. No reusar misión sintética cancelada.
- Primer dry-run de Node falló con `fetch failed`; repetir con `node --use-system-ca` devolvió metadatos actuales de 12 rutas y `dispatched:false`.
- Tests del adaptador: 6/6 aprobados. El ensayo end-to-end de camelRun en sesión previa sí generó JSON estricto, pero el puente nuevo todavía requiere credencial del runtime.

## Reversión y continuidad

El código está aislado bajo `tools/camelrun-bridge/`; se revierte mediante la PR sin alterar otros agentes ni la tarea Windows. Este workflow valida automáticamente PRs que cambien el puente (solo GET y dry-run) y permite `workflow_dispatch` manual para live, cuando exista en la rama predeterminada (sin cron ni autoactivación de modelos), permisos GitHub limitados a lectura, y no ejecuta `--live` sin confirmación de modo. No hay daemon 24/7: para operación persistente se necesitará un disparador autorizado y aprovisionamiento secreto; una PR o agente creado no certifica eso.
