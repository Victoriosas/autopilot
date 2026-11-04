---
name: victoriosas-control-de-fases
description: Mantener visión, prioridades y estado verificado de Victoriosas pública y Autopilot motor IA. Usar al iniciar misiones técnicas, sincronizar PC/cloud y decidir la siguiente fase sin desviar el proyecto.
---

# Control de fases Victoriosas + Autopilot

## Inicio de cada misión
1. Leer `AGENTS.md` y `docs/PROJECT_DIRECTION.md`. No sustituir por memorias o prompts viejos.
2. Verificar `git status`, ramas/worktrees locales si se dispone de PC, SHA real de GitHub `main`, PR y checks. PC desconectada significa estado local **desconocido**.
3. Consultar solo el rango de cambios necesario desde el último checkpoint y `docs/AUTOPILOT_STATE.md`.
4. Confirmar metadatos de Vercel production SHA, Supabase principal vs secundario, Resend y camelRun sin secretos ni PII.

## Elección de trabajo
- Elegir la fase activa más temprana sin su puerta completa: F1 consulta confiable, F2 conocimiento, F3 laboratorio, F4 recepción supervisada.
- No agregar agentes, ramas, integración social, SaaS, campañas o ecommerce antes de cerrar bloqueos de fase. Registrar ideas fuera de alcance, sin ejecutarlas.
- En cada PR declarar `Fase / Hipótesis / Evidencia antes / Cambio mínimo / Tests / Rollback / Datos y costes / Estado`.
- Clasificar `DEFINIDO / PROBADO / FUSIONADO / DESPLEGADO / EJECUTADO / BLOQUEADO`; nunca mezclar pruebas mock con ejecución real.

## Sincronización de PC
- Consultar `docs/SYNC_PC_GITHUB_SEGURO.md`. Inventariar estado y respaldar worktrees y archivos no rastreados. No `reset --hard`, `clean`, `stash` ni force push. No realizar pull sobre árbol sucio.
- Si la PC no responde, avanzar solo en PR remotas independientes y señalar bloqueo local; no declarar PC sincronizada.

## Guardas
- Cero datos identificables, evaluaciones de salud o tokens en Git/terminal compartida.
- Sin envíos reales, pruebas productivas invasivas, pagos, migraciones irreversibles o despliegues manuales por defecto. Pedir o verificar autorización específica y reversibilidad de acciones sensibles.
- Responder clínicamente solo con hechos versionados/revisados por Victoria y evaluación adecuada; guardar borradores y revisión humana.
- Determinar costo total de proveedor, runtime, almacenamiento, API y red antes de activar modelo remoto.
- CI omitida ≠ prueba aprobada. Un agente configurado ≠ agente ejecutándose.

## Cierre de misión
1. Entregar evidencia que desbloquea la fase, no solo código.
2. Actualizar continuidad fechada y enlaces a PR/issue; priorizar el siguiente bloqueador.
3. Verificar automatizaciones existentes antes de crear nuevas; un monitor no modifica infraestructura por sí mismo.
