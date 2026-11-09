---
name: autopilot-safety
description: Guardia de seguridad y resolución de bloqueos para agentes Codex/Autopilot. Activar antes de mutaciones, ante concurrencia, datos sensibles, acceso ausente, proveedores, 403, pagos, producción o límites de cuotas.
---

# Autopilot Safety | Barreras irrenunciables

## Antes de modificar
1. Identificar instrucciones de nivel superior, alcance autorizado, repo, rama/HEAD, worktree y cambios ajenos. Si el entorno es antiguo o ambiguo, solo lectura hasta verificar.
2. Determinar si existe otro ejecutor en el mismo ámbito. Si hay concurrencia sin coordinación, preservar recursos compartidos y continuar solo en un ámbito independiente con base verificada.
3. Verificar el permiso específico de la operación; la solicitud de autonomía NO permite publicaciones, migraciones remotas, envío a clientas, campañas, pagos, compras, DNS, claves, producción ni auto-merge.
4. Minimizar PII: no subir información de clientas, credenciales, mails identificables ni secretos a logs, commits, pruebas o modelos. La evaluación estética es remota y supervisada, no un diagnóstico clínico.
5. Para F3 mantener laboratorio autorizado, pruebas limitadas y `no_send`; 6 controles aprobados no significa que todos los casos estén aprobados.

## Bloqueos y fallos
- Diferenciar falta de acceso de error reparable. Registrar evidencia sin exponer secretos. Si el cambio riesgoso es necesario, preparar runbook/reversión y aguardar permiso específico; continuar tareas independientes.
- HTTP 403 no demuestra por sí solo Cloudflare: pedir evidencia del encabezado `cf-mitigated` u otra verificación fiable; no desactivar protecciones para pasar CI.
- Límite de Codex/API: respetar cuota, no rotar cuentas, no usar otro proveedor o claves sin permiso. Guardar checkpoint y terminar ordenadamente.
- Hasta tres reintentos transitorios seguros; antes de repetir una mutación, comprobar idempotencia y si ya ocurrió.
- El estado `BLOCKED_*` debe describir dependencia real y no ocultar trabajo posible.

## Matriz compacta
| Situación | Acción |
| --- | --- |
| Base sin verificar o edición concurrente en el mismo ámbito | Solo lectura en los recursos afectados; no afirmar sincronización |
| PR en borrador o CI de SHA distinto | No fusionar; revalidar SHA exacto |
| Falta conocimiento profesional de Victoria | Borradores explícitos, sin sustituir su aprobación |
| Correo, WhatsApp, agentes no comprobados end-to-end | No afirmar servicio activo ni enviar a clientas |
| Acción remota irreversible o con coste | No ejecutar sin permiso específico |
| Sin tarea segura nueva | Cerrar sin commits, PR ni checkpoints vacíos |

Salida: operación permitida o bloqueada, razón, evidencia y alternativa reversible.
