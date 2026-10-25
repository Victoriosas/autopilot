---
name: victoriosas-autopilot-operational-audit
description: Auditar los seis agentes de Victoriosas usando evidencia real, sin activar comunicaciones, pagos ni permisos privilegiados.
---

# Auditoría operativa Victoriosas

## Fuentes de verdad
1. Confirmar HEAD de main, PR, checks y commits; nunca inferir despliegue por merge.
2. Comprobar en Vercel el despliegue productivo y SHA exacto.
3. Consultar en Supabase únicamente esquemas, conteos agregados y metadatos permitidos de agent_tasks y agent_audit_events; no extraer mensajes, nombres, correos, teléfonos ni datos clínicos.
4. Inspeccionar workflows de GitHub Actions: cron, workflow_dispatch, últimas ejecuciones, step summaries y fallos. Un workflow configurado no cuenta como ejecución.
5. Revisar camelRun: deployed, loaded, herramientas conectadas y evidencias de runs; una definición no cuenta como agente activo.
6. Validar panel admin con sesión autorizada, sin suplantar credenciales ni desactivar autenticación.

## Clasificación obligatoria de estados
- DEFINIDO: archivo o manifiesto presente.
- PROBADO: pruebas reproducibles exitosas con datos sintéticos.
- FUSIONADO: commit presente en main.
- DESPLEGADO: build productivo READY asociado al SHA.
- EJECUTADO: tarea real con registro de resultado y auditoría verificables.
- BLOQUEADO: dependencia o permiso ausente; indicar prueba y acción de desbloqueo.

## Diseño mínimo y seguridad
- Reutilizar la cola SQL de seis agentes y sus leases; no crear cola paralela.
- Para informes remotos, exponer solamente agregados aprobados, con autenticación acotada. No compartir SUPABASE_SERVICE_ROLE_KEY en CI ni logs; no rebajar RLS.
- Aplicar idempotencia, claim transaccional, fencing token, backoff acotado, límite de consumo y evidencia antes de cerrar tareas.
- Mantener modo supervisado para consultas y seguimiento; no enviar mensajes a clientas sin consentimiento y autorización.
- No iniciar servicios de pago, activar checkout, borrar datos productivos ni aplicar migraciones destructivas.
- La PC del operador es herramienta opcional; la continuidad no debe depender de ella. No modificar un checkout local con archivos no rastreados sin aislar primero el trabajo.

## Criterio de salida
Informar por separado configurado, probado, fusionado, desplegado y ejecutado. Indicar fecha de observación, pruebas aprobadas/fallidas, métricas agregadas, límites del plan gratuito y bloqueos demostrados. Si no hay actividad en agent_tasks o agent_audit_events, declarar ejecución NO VERIFICADA, nunca 24/7 operativo. En caso de bloqueo, continuar con verificaciones independientes.
