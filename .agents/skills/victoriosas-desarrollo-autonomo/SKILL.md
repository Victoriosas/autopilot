---
name: victoriosas-desarrollo-autonomo
description: Habilidad principal de Codex para Victoriosas/Autopilot. Activar en cada sesión y ciclo programado de desarrollo, auditoría o mantenimiento en el repositorio Victoriosas/autopilot; coordina las otras cuatro habilidades y aplica prioridades F1-F4, seguridad y continuidad.
---

# Victoriosas Desarrollo Autónomo | Coordinador principal de Codex

**Identidad:** Victoriosas es el sitio público informativo de estética profesional; Autopilot es el motor interno de consultas, secretaría, correo, WhatsApp y evolución futura. Codex es el ejecutor técnico principal. No reactivar OpenCode en paralelo, ecommerce, dropshipping o dominios antiguos.

## Comprobaciones iniciales del trabajo técnico
1. Verificar PC y raíz del repositorio. Leer `AGENTS.md`, `.github/copilot-instructions.md`, `docs/PROJECT_DIRECTION.md` y la última entrada relevante de `docs/AUTOPILOT_STATE.md`. Si falta un archivo, indicar su ausencia; nunca reconstruirlo por memoria como si estuviese leído.
2. Comparar Git local/remoto, rama y HEAD, PR activas, CI asociada a SHA exacto, worktrees, archivos modificados y ejecuciones concurrentes. Si la base es incierta o hay trabajo ajeno activo en el mismo ámbito, mantener esos recursos en solo lectura. Una tarea independiente puede seguir en un worktree aislado con base remota verificada y permisos vigentes.
3. Aplicar `$autopilot-safety` como puerta de acción, `$autopilot-roles` para la decisión, `$autopilot-core` para ejecutar un ciclo y `$ahorro-continuidad-autopilot` para reducir trabajo redundante. Cargar las habilidades de apoyo solo cuando aporten al trabajo. Usar `$victoriosas-control-de-fases` para seleccionar la fase vigente y las habilidades especializadas de `docs/CODEX_SKILLS.md` según el cambio. Las cinco están subordinadas a la orden vigente y a reglas superiores; si una no está disponible, aplicar sus barreras mínimas y registrar la limitación.
4. Seleccionar **una tarea segura prioritaria**. Cumplir criterios, pruebas y checkpoint; iniciar otra únicamente si es independiente y no prolonga innecesariamente una ejecución programada. Nunca crear PR duplicada.

## Prioridades estables, adaptadas al estado vigente
- **F1 consultas fiables:** `/consultanos`, `/api/health`, configuración real del formulario, rutas API, protección de `/admin`, consentimiento, correo realmente recibido, retención e idempotencia. Un canario no demuestra disponibilidad continua.
- **F2 conocimiento:** catálogo de 17 tratamientos y fichas internas. Los contenidos no revisados por Victoria se consideran provisionales; no realizar afirmaciones clínicas ni promesas.
- **F3 laboratorio IA:** pruebas y evaluaciones aisladas, diagnósticos offline, guardián, `no_send` y revisión humana. No reejecutar modelos pagos o pruebas reales por inercia.
- **F4 envíos supervisados:** aprobación humana explícita, control de duplicados y trazabilidad. Respetar la preferencia de WhatsApp o llamada. El correo es un canal adicional que requiere dirección válida, consentimiento y aprobación humana del envío concreto.

## Reglas técnicas
- Al modificar lógica crítica, priorizar RED/GREEN y regresiones. Verificar `npm run verify` donde aplique y checks GitHub por SHA exacto (`validate`, `postgres`, etc.). Evitar pruebas redundantes de la misma versión sin cambio.
- Trabajar solo en rama/worktree aislado con base verificada y permiso real; PR en borrador revisable. No auto-merge, deploy, migración alojada, DNS, pagos, campañas ni envíos a clientas sin autorización específica.
- No exponer PII ni secretos. No tratar 403 como desafío Cloudflare sin evidencia. No atribuir funcionamiento a simulaciones.
- Respetar trabajos ya terminados y PR abiertas; no revivir tareas superadas.

## Contrato de salida
`Entorno y SHA | prioridad | cambio verificable | pruebas realizadas | riesgo/bloqueo | siguiente paso`.
Si no hubo novedad material, no crear nuevos registros ni commits vacíos. Una automatización activa intenta ejecutar en horarios acordados, pero no garantiza disponibilidad de PC, credenciales, cuota o ejecución efectiva.
