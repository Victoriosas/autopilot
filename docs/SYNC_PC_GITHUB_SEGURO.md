# Sincronización segura micahael-PC ↔ GitHub
Último control: 2026-11-04. La PC figura **offline** en Desktop Commander. No ejecutar este procedimiento hasta que el dispositivo vuelva a conectarse y su estado local sea inspeccionable.

## Principio
`origin/main` no se impone sobre `C:\autopilot`. El repositorio puede contener trabajo Codex, OpenCode, ramas/worktrees y archivos sin seguimiento. Primero preservar, luego comparar, después integrar y finalmente probar.

## Fase 1. Solo inventario, desde PowerShell en la PC
```powershell
git -C C:\autopilot rev-parse --show-toplevel
git -C C:\autopilot remote -v
git -C C:\autopilot status --short --branch
git -C C:\autopilot worktree list --porcelain
git -C C:\autopilot branch -vv
git -C C:\autopilot log -8 --date=iso --pretty=format:"%h %ad %s"
```
No copiar a tickets ni al chat rutas sensibles, tokens, archivos .env o datos reales. También revisar directorios de laboratorio Codex y repositorios distintos antes de asumir que toda modificación ocurrió en `C:\autopilot`.

## Fase 2. Preservación
- Preparar una copia local fechada del repositorio (incluido `.git` y worktrees que correspondan), sin publicarla ni subir secretos.
- Inventariar modificaciones y archivos no rastreados; si hay cambios únicos, hacer commit **en rama local nueva** o copia fuera de Git, previa revisión de secretos. Nunca `git stash` automático.
- `git fetch origin` para actualizar referencias remotas sin alterar archivos de trabajo. Comparar `git log --left-right --oneline HEAD...origin/main` y `git diff --stat HEAD..origin/main`; inspeccionar también ramas del laboratorio.

## Fase 3. Integración controlada
- Si HEAD es `main` y el árbol está limpio, se puede hacer `git merge --ff-only origin/main` después de revisar el resultado del inventario.
- Si hay divergencia o archivos modificados: trabajar en rama/worktree de reconciliación, fusionar o cherry-pick únicamente los commits pertinentes y resolver conflictos por archivo. No `pull --rebase` indiscriminado, `reset --hard`, `clean -fd`, `push --force`.
- No subir backups, capturas con PII, `.env`, caches ni credenciales; escanear diff antes de un push.

## Fase 4. Validación y reporte
- `npm ci` solo si la instalación de dependencias lo exige y se verificó costo/espacio; `npm run verify` y pruebas de consultas/PostgreSQL según cambios.
- Comparar SHA local con GitHub/CI, Vercel SHA productivo y 41 migraciones reales Supabase. Confirmar si se sincronizaron **PC / remoto / producción** por separado.
- Resultado esperado: reporte de rama, HEAD local/remoto, ahead/behind, archivos conservados, commits incorporados, tests, bloqueos y pasos de reversión.

No usar el estado de este documento como evidencia de que la sincronización ya ocurrió.
