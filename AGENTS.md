# Victoriosas / Autopilot: guía de trabajo

## Dirección y fases del producto
- **Fuente principal de visión**: `docs/PROJECT_DIRECTION.md`, con roles, límites, fases F0–F8, criterios de salida y prioridad activa; leerla antes de crear trabajo nuevo.
- **Estado auditado 3–4/11/2026**: `docs/AUDITORIA_DIRECCION_20261104.md`. Confirmar HEAD y servicios: el informe es una foto, no un estado permanente.
- **PC/GitHub**: `docs/SYNC_PC_GITHUB_SEGURO.md`. Si Desktop Commander está desconectado, no afirmar PC sincronizada.
- Usar `$victoriosas-control-de-fases` para impedir que tareas laterales desplacen la ruta crítica. Codex, OpenCode y Work comparten el objetivo, pero no comparten necesariamente sesiones, permisos o estado de ejecución.

## Herramienta principal: Codex (decisión 2026-11-05)
- **Codex es el ejecutor técnico principal** de Victoriosas: planificación del cambio, edición, pruebas y preparación de PR. Respetar las fases y aprobaciones de `docs/PROJECT_DIRECTION.md`.
- OpenCode queda **secundario, opcional y bajo demanda**. No delegarle tareas paralelas a Codex sobre los mismos archivos, no arrancar procesos de OpenCode automáticamente ni utilizarlo como director del proyecto.
- Si se demuestra interferencia real (procesos simultáneos, sobreescritura de archivos, consumo indebido, conflicto de worktrees o permisos), detener primero la ejecución de OpenCode, preservar su trabajo local y deshabilitar su arranque de forma reversible. Solo desinstalar después de inventariar respaldos y comprobar que Codex no depende de sus herramientas. No borrar worktrees, sesiones, skills ni credenciales por presunción.
- `.github/workflows/opencode-workstation.yml` valida su configuración solo al cambiar los archivos relevantes o mediante ejecución manual; no equivale a un agente ejecutándose en segundo plano.

## Antes de actuar
- Leer este archivo, docs/OPENCODE_CHECKPOINT.md y .github/copilot-instructions.md. Consultar el historial solo en rangos necesarios para la tarea.
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

## OpenCode: perfiles vigentes

Leer docs/OPENCODE_DIRECTIVES.md y tools/opencode-workstation/README.md. Los perfiles no son procesos permanentes.

- ingeniero: cambios locales y pruebas.
- director: planificación y delegación secuencial.
- arquitecto: arquitectura y nuevos proyectos.
- revisor, seguridad y datos: revisión en lectura.
- qa: pruebas y navegador aislado.
- operaciones: estado de GitHub, Vercel y gateway en lectura.
- documentacion: documentación oficial y borradores.
- consulta: conversación sin herramientas.

Los perfiles históricos de dropshipping y ECC quedan deshabilitados en la configuración de OpenCode; no son instrucciones comerciales actuales. Copilot y Codex conservan sus propias integraciones. No comprar cuotas ni habilitar proveedores pagos.

## Habilidades de Codex

- Para desarrollo sostenido o mantenimiento de Autopilot, usar `$victoriosas-desarrollo-autonomo` como guía del ciclo técnico. Seleccionar la fase con `$victoriosas-control-de-fases` y cargar los apoyos pertinentes según la tarea.
- Para tareas repetidas usar las habilidades específicas en `.agents/skills/` descritas en `docs/CODEX_SKILLS.md`.
- Seleccionar una habilidad pertinente y leer sus referencias bajo demanda; no cargar todas ni tomar una skill como autorización para gastar, publicar o desplegar.
