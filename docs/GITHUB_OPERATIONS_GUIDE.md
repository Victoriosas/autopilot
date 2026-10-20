# GitHub de Victoriosas: operación

## Configuración comprobada el 19 de octubre de 2026
- Repositorio público; no subir datos privados.
- [Ruleset activo de main](https://github.com/Victoriosas/autopilot/settings/rules/25446201): PR, checks `validate` y `postgres` de GitHub Actions, rama actualizada y conversaciones resueltas; impide borrado y force-push. Sin bypass y sin aprobación obligatoria de otra cuenta.
- Limpieza automática de ramas fusionadas y sugerencia de actualización de ramas activadas; auto-merge permanece deshabilitado.
- Limpieza realizada: 70 ramas con PR fusionada y cero commits por delante de main; 23 ramas conservadas antes de crear esta PR. No borrar ramas con commits propios solo porque la PR figura fusionada.
- Grafo de dependencias, alertas Dependabot y malware, parches de seguridad agrupados y reportes privados activados.
- Secret Protection y Push Protection ya estaban activos.
- CodeQL default setup para JavaScript/TypeScript y GitHub Actions; setup 39354535228 exitoso. Esto no demuestra ausencia de vulnerabilidades.
- Actions usa token de lectura por defecto; creación/aprobación de PR por Actions deshabilitada. Workflows de todos los colaboradores externos requieren aprobación.
- Codex review agotó su cuota al revisar PR97. No comprar créditos ni presentar el fallo de cuota como revisión aprobada.

## Mantenimiento propuesto en esta PR
`.github/dependabot.yml` revisa npm y GitHub Actions los lunes, hora de Montevideo. Límite de PR de versiones: dos npm y una de Actions; agrupa minor/patch npm y Actions. Los major npm se revisan por separado. Los límites no limitan las PR de seguridad de Dependabot. No hay auto-merge ni actualización automática de producción. Se activa al fusionar la configuración a la rama predeterminada.

## Trabajo diario
1. Revisar issues y PR existentes; evitar repetir #81 (identidad/redes), #84 (contenido/SEO) y PR90 documental.
2. Usar los formularios de fallo o mejora con criterios de aceptación. Security privado para vulnerabilidades.
3. Rama y PR pequeña, evidencia del SHA final y pruebas proporcionales. No confundir preview, main y producción.
4. Revisar Dependabot y CodeQL en Security. Priorizar vulnerabilidades confirmadas; nunca descartar alertas para obtener un estado verde.
5. Revisar `validate` y `postgres`; pruebas Supabase omitidas no acreditan integración.
6. Fusionar solo con autorización vigente, comprobar publicación por SHA cuando corresponda y cerrar tareas con evidencia.

## Automatizaciones y agentes
Se conservan Autopilot Core v4, Isolated Beauty Supabase, Isolated Commerce Supabase y Victoriosas Public Health cada seis horas. No se añade otro scheduler ni se habilitan pagos, captación o publicación comercial.

Los cinco perfiles OpenCode son guías, no agentes que GitHub ejecute por sí solo. AGENTS.md y copilot-instructions.md definen límites compartidos. Un agente necesita runtime, permisos y cuota. No habilitar agentes pagos para compensar una cuota agotada.
