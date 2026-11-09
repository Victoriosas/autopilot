# Habilidades de Codex para Victoriosas

Estas habilidades viven en `.agents/skills/<nombre>/SKILL.md` y funcionan como instrucciones **por tarea**, no como procesos ni conectores permanentes. Codex descubre sus descripciones y solo carga el contenido de la habilidad elegida. La habilidad histórica `victoriosas-autopilot-operational-audit` se conserva.

| Tarea | Habilidad para invocar en Codex |
| --- | --- |
| Formulario /consultanos y Resend | `$victoriosas-consultas-e2e` |
| Comprensión, Redactor, Guardián en camelRun | `$victoriosas-camelrun-laboratorio` |
| Fichas de tratamientos, evidencia y precios | `$victoriosas-conocimiento-tratamientos` |
| CI, PR, Vercel, despliegue y Cloudflare | `$victoriosas-publicacion-verificada` |
| Privacidad, Auth, RLS y guardas | `$victoriosas-privacidad-seguridad` |
| Ahorro de tokens y trabajo continuo | `$victoriosas-codex-ahorro-tokens` |
| Auditar seis agentes y sus ejecuciones | `$victoriosas-autopilot-operational-audit` |
| Mantener el norte, seleccionar la fase y sincronizar PC/cloud sin perder cambios | `$victoriosas-control-de-fases` |
| Coordinar desarrollo sostenido, auditoría y mantenimiento | `$victoriosas-desarrollo-autonomo` |
| Ejecutar un ciclo técnico con aceptación y evidencia | `$autopilot-core` |
| Revisar decisiones de arquitectura, producto y release | `$autopilot-roles` |
| Comprobar permisos, concurrencia y bloqueos | `$autopilot-safety` |
| Reanudar ciclos y respetar cuotas | `$ahorro-continuidad-autopilot` |

## Cómo usarlas

1. Abrí el proyecto **autopilot** en Codex y verificá que su rama incluya estos archivos. Una PR no fusionada no actualiza por sí sola tu `main` local ni el entorno cloud.
2. En Codex escribí una tarea directa, por ejemplo: `$victoriosas-consultas-e2e Investigá por qué el formulario muestra sin conexión; creá una PR con pruebas sintéticas.`
3. Podés pedir que Codex seleccione automáticamente la habilidad adecuada. En tareas pequeñas es mejor una sola habilidad principal.
4. Después de fusionar la PR y actualizar la rama, Codex suele detectar nuevas habilidades; si no aparecen, reiniciá la sesión/app.
5. Comprobar formato del repositorio: `node scripts/check-codex-skills.mjs`.

## Restricciones transversales

`AGENTS.md` gobierna estas habilidades. Ninguna habilidad instala MCP, valida conexiones por sí sola ni activa agentes 24/7. No autoriza gasto, cambios de DNS, correos reales, respuestas autónomas, precios públicos, migraciones productivas ni despliegues manuales.

[Documentación de OpenAI sobre instalación de habilidades por proyecto](https://developers.openai.com/api/reference/cli).
