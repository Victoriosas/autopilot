# Victoriosas / Autopilot: instrucciones de agentes GitHub

Idiomas: usar español en contenidos visibles, issues y PRs; respetar los textos aprobados.

## Fuente de verdad
- Leer AGENTS.md, docs/OPENCODE_CHECKPOINT.md y el código afectado; consultar el historial por rangos si hace falta.
- GitHub Copilot, Codex y los perfiles de `.opencode/agent/` son herramientas diferentes. Estos últimos **no** se ejecutan automáticamente por estar en GitHub.
- La web oficial es `victoriosas.online`; no restaurar dominios legados ni cambiar DNS.
- Conservar la marca **Victoriosas**. No cambiar lemas, fotografías aprobadas ni datos de contacto sin autorización.

## Trabajo seguro
- Crear rama y PR; evitar cambios directos a `main`, no hacer auto-merge ni despliegue manual.
- Preservar archivos locales sin seguimiento, cambios ajenos y ramas con trabajo activo.
- Antes de declarar terminado: `npm run verify`, tests de cambio relevante y CI de PostgreSQL / Supabase cuando aplique.
- Código Node/React/TypeScript; minimizar diffs; implementar pruebas antes o junto con lógica nueva.
- Nunca registrar claves, tokens, datos sensibles, respuestas médicas, emails de clientes o archivos `.env.local`.
- No lanzar pagos reales, publicar productos automáticamente, comprar insumos, contactar terceros ni ejecutar migraciones remotas sin aprobación específica.
- Las fichas de servicios estéticos deben tener lenguaje responsable, evitar afirmaciones clínicas garantizadas, y limitarse a la evaluación/consulta para procedimientos no confirmados.
- Los agentes de `sourcing`, `analyzer`, `seo`, `deploy` y `monitor` son guías de OpenCode. Agente `deploy`: nunca cambiar producción por iniciativa propia.
- Al terminar: resumir cambios, comandos y pruebas, bloqueos, enlaces de PR y siguiente tarea segura; no decir que hay despliegue si no se comprobó el SHA en el sitio.
