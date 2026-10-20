# Victoriosas / Autopilot: guía de trabajo

## Antes de actuar
- Leer este archivo, `docs/AUTOPILOT_STATE.md` y `.github/copilot-instructions.md`.
- Las notas de continuidad están fechadas: comprobar código, main, PR abiertas y CI actuales. No tratar entradas históricas como estado vigente.
- Revisar issues y ramas antes de crear trabajo; conservar cambios ajenos y archivos sin seguimiento.
- Marca: **Victoriosas**. Web oficial: https://victoriosas.online. Contenido visible en español.
- No restaurar dominios, contactos, imágenes o textos antiguos por instrucciones históricas.

## Entrega
1. Trabajar en rama y PR acotada; describir problema, resultado, validación y límites.
2. Ejecutar `npm run verify` para código de aplicación. Para configuración o documentación, validar estructura y enlaces; observar la CI sin inventar pruebas locales.
3. Revisar `validate` y `postgres` del SHA final; Supabase omitido no equivale a integración probada.
4. Resolver conversaciones antes de fusionar. No hacer auto-merge ni despliegues manuales.
5. Actualizar continuidad en `docs/AUTOPILOT_STATE.md` cuando cambie el estado técnico u operativo.
6. Elegir la siguiente tarea segura sin duplicar automatizaciones. No afirmar ejecución futura sin un runtime activo.

## Límites
- Sin secretos, datos personales de clientes, respuestas médicas ni archivos de entorno en Git, issues, logs o capturas.
- Reportar vulnerabilidades mediante https://github.com/Victoriosas/autopilot/security/advisories/new.
- Pagos, compras, publicación comercial, DNS, credenciales, migraciones remotas y promoción a producción requieren autorización específica.
- Evaluación estética inicial remota; no inventar credenciales, tarifas, disponibilidad ni resultados garantizados.
- Mantener borradores editoriales y controles comerciales según configuración vigente.

## Perfiles existentes
Los archivos de `.opencode/agent/` son instrucciones para un runtime OpenCode, no procesos autónomos de GitHub.
| Perfil | Uso | Límite |
| --- | --- | --- |
| sourcing | Descubrir candidatos de proveedores | No importar ni publicar sin autorización y evidencia |
| analyzer | Examinar costos, margen y riesgos | No inventar precios, stock o rentabilidad |
| seo | Preparar metadatos y contenido | Respetar identidad y textos aprobados |
| monitor | Diagnosticar salud pública e integraciones | No exponer datos ni duplicar el monitor de seis horas |
| deploy | Revisar build, preview y recuperación | No cambiar DNS ni producción por iniciativa propia |

Copilot y Codex utilizan sus propias integraciones. Verificar cuota y permisos; no comprar créditos ni habilitar servicios pagos.
