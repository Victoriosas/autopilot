# GitHub de Victoriosas: mapa de uso y mejoras

## Qué está activo
- **Actions**: workflows existentes de `Autopilot Core v4` (TypeScript, tests, compilaciones, revisión de secretos y PostgreSQL), `Isolated Beauty Supabase`, `Isolated Commerce Supabase` y `Victoriosas Public Health` (cada 6 h).
- **Agentes OpenCode**: `sourcing`, `analyzer`, `seo`, `deploy`, `monitor`. Sus descripciones están en `.opencode/agent/`. No son GitHub Actions ni agentes Copilot instalados.
- **Copilot**: las reglas recomendadas en `.github/copilot-instructions.md` guían asistentes que admitan instrucciones del repositorio; no contratan ni activan Copilot.
- **Plantilla de PR**: fomenta pruebas, revisión y resguardo de datos.

## Hallazgos confirmados al 19 de octubre de 2026
- Repositorio **público**. Verificar que esta visibilidad sea intencional antes de añadir documentación sensible.
- Lista de rulesets a nivel repositorio: **vacía**. La conexión de GitHub devuelve 403 al leer protección clásica de `main`; por tanto NO afirmar si existe o no protección clásica.
- GitHub informó `delete_branch_on_merge=false` y `allow_auto_merge=false`. El primero deja acumulación de ramas; el segundo evita fusiones automáticas.
- Homepage del repositorio apunta a un despliegue legado; revisar manualmente si conviene actualizarla a `https://victoriosas.online`.
- GitHub Discussions está deshabilitado; puede seguir así, no es requisito para desarrollar.

## Configuración recomendada al propietario (requiere permisos de Settings)
1. **Settings → Rules → Rulesets**: regla de rama objetivo `main` con PR obligatorio, checks `validate` y `postgres`, conversación resuelta antes de fusionar, impedir force-push y borrado de `main`. Comprobar alcance del plan de GitHub y existencia de reglas previas. No activar sin confirmar los nombres exactos de jobs ni evaluar el efecto sobre Vercel.
2. **Settings → General → Pull Requests**: considerar *Automatically delete head branches*; no afecta ramas sin PR fusionada.
3. **Settings → Security / Code security**: habilitar alertas Dependabot, escaneo de secretos y avisos de dependencias según opciones gratuitas y permisos disponibles. Los eventos de seguridad requieren revisión; no activar actualizaciones automáticas masivas sin proceso de triage.
4. **Settings → Actions → General**: usar permisos de token por defecto de solo lectura y limitar los flujos permitidos a acciones confiables. Mantener `permissions: contents: read` en YAML salvo motivo expreso.
5. **Settings → General**: cambiar descripción y enlace homepage a la web oficial, conservando historial; confirmar antes si otros sistemas dependen de los metadatos.
6. **Security → Private vulnerability reporting**: configurar canal privado de reportes antes de recibir información sensible.

## Agentes: función práctica
- **Sourcing**: descubre candidatos; no publica ni compra automáticamente.
- **Analyzer**: examina coste/riesgo; no inventa evidencia.
- **SEO**: redacta títulos y descripciones para revisión.
- **Monitor**: comprueba estado y prepara diagnósticos sin secretos.
- **Deploy**: revisa previews/rollback; jamás cambia producción sin aprobación.
- **Copilot/Codex**: lee instrucciones, propone cambios en PR y valida. No sustituye permisos, pruebas ni aprobación del propietario.

## Flujo recomendado
Issue o solicitud → rama → pruebas → PR en borrador → checks y revisión → fusión aprobada → verificación de Vercel/producción. Nunca confundir un commit en `main` con un despliegue exitoso.
