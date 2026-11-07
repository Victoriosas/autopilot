# Plan de continuidad F1–F3 · 06/11/2026

Responsable técnico: Codex. Alcance: terminar estabilización y validación; publicación, gasto y atención real tienen puertas independientes. [Dirección](PROJECT_DIRECTION.md), [evidencia F3](F3_RECUPERACION_OFFLINE_20261106.md).

## Base y cierre técnico

Main: `908ae4e`. [PR #196](https://github.com/Victoriosas/autopilot/pull/196): código `574ad62`, documentación `634d761`. [PR #197](https://github.com/Victoriosas/autopilot/pull/197): `50fcea8`. Ambas draft, checks requeridos aprobados y cero hilos de revisión registrados; esto no equivale a aprobación humana.

Ensayo local combinado: commit sintético `d3bd06684d17eef9c4f594f007cf96048c67b629`, árbol `43d13314717ed7a6faba66296a0c3d00310f2611`, worktree separado. `npm run verify`: **428/428**, cero fallos/omisiones, tipos, skills y ambos builds. HTML, secretos, manifiesto, corpus intacto y dry-run 32+6 correctos. **PROBADO LOCALMENTE**, sin publicar esa integración.

GET productivos: health 200, SHA 908ae4e, checkout cerrado; consultas habilitadas, privacidad v1/30d. Sin POST ni recepción humana nueva. Último Public Health 42280974809 falló; correlación Cloudflare fuerte, vínculo exacto pendiente.

## Secuencia ejecutable

1. **Publicación pendiente de autorización específica:** fusionar #197 primero; comprobar main/CI, deploy automático y health. El monitor mantendrá fallo ante 403; observar el siguiente run ordinario y correlacionar Ray, sin reducir WAF.
2. Revalidar #196 contra main actualizado, conservar ambas notas, exigir checks aplicables del head y ausencia de defectos pendientes; después fusionar #196 con autorización productiva. Comprobar el SHA desplegado y no_send. Sin auto-merge.
3. **Evaluación pendiente de autorización específica:** workflow existente, main, primer intento, modo development; 32 casos+6 controles, sin finales. Reserva preventiva US$2,04; máximo 102 ejecuciones aisladas. Sin reintento automático. Ante cualquier fallo, mantener F3 bloqueada y diagnosticar por etapa.
4. Solo con desarrollo/control completos aprobados, solicitar autorización separada para 40+6. Después preparar F4 supervisada; ningún resultado habilita envíos automáticamente.

## Costes, reversión y límites

Catálogo camelRun consultado sin inferencia: Haiku 5.5 disponible; cálculo preventivo vigente 0,01862 USD por etapa frente a reserva 0,02. Revalidar tarifa mediante preflight al ejecutar; no es factura ni coste total de infraestructura.

Rollback: revertir cada PR en orden inverso mediante rama revisada; validar CI y publicación autorizada. Sin migraciones ni definiciones remotas aplicadas que deshacer. Preservar evidencia histórica.

Puerta actual: aprobación de fusiones con despliegue automático y presupuesto de 32+6. Cero gasto nuevo autorizado, inferencias o envíos realizados. No se promete operación 24/7 ni se duplica scheduler.
