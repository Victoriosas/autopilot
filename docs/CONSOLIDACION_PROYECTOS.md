# Consolidacion local - 2026-10-17

Autopilot canonico: C:\autopilot. Rama: codex/post-merge-review-20261010.

## Integrado y validado

- Catalogo manual con canales de afiliacion y consulta, revision vinculada a la version publicada.
- Panel administrativo de investigacion Firecrawl y estado de afiliados.
- Validacion de redireccion Mercado Pago contra la orden reservada.
- Diagnostico de autenticacion CJ y sonda de lectura.
- Documentacion de candidatos revisados y evidencias de proveedores.
- Cambios locales previos del storefront restaurados, sin atribuirlos a las ramas integradas.

Validacion del arbol combinado: npm run verify, exit 0; TypeScript, 163/163 pruebas, build servidor y build Vercel. Advertencia existente de bundle mayor a 500 kB.

## Limpieza realizada

Retiradas mediante git worktree remove las carpetas C:\autopilot-firecrawl, C:\autopilot-channels, C:\autopilot-cj-review, C:\autopilot-payment-review y C:\autopilot-catalog-review. Antes de retirarlas se comprobo que cada HEAD era ancestro del Autopilot consolidado. Archivos modificados y sin seguimiento respaldados con hashes verificados en .git/consolidation-20261017. Las ramas y su historial permanecen en Git.

.env.local de Autopilot conserva exactamente el hash anterior a la consolidacion. No se cambiaron remotos, secretos, proyectos Supabase, DNS ni despliegues. Preservar el stash pre-consolidation-20261017 hasta revisar los cambios locales.

## Proyectos distintos pendientes de migracion funcional

| Proyecto | Ruta conservada | Motivo |
|---|---|---|
| Marketplace Next.js | C:\victoriosa-autopilot-admin-control-center | Tiene su propio esquema, Auth y reglas de staging; requiere adaptar funciones a los contratos de Autopilot. |
| Repositorio base Marketplace | C:\victoriosa | Git common dir requerido por el worktree anterior y cambios locales unicos. |
| ExpressJobs | C:\CODEX-expressjobs-repo | Microtrabajos, postulaciones, chat y reputacion; dominio y base distintos. |
| Nomadea | C:\web | Buscador de empleo remoto, Auth y proyecto propios. |
| Copia antigua Autopilot | C:\autopilot-audit-ready-updated | Sin Git; comparar archivos y configuracion antes de eliminar. |
| Respaldos previos | C:\autopilot-backups | Recuperacion; no se clasificaron completamente. |

Entrada central de inspeccion: powershell -NoProfile -File C:\autopilot\scripts\projects.ps1. Para verificar Autopilot: agregar -Action verify. El comando status solo consulta Git, sin leer secretos ni cambiar proyectos.

No se afirma que ExpressJobs, Nomadea o el Marketplace antiguo esten integrados funcionalmente en la aplicacion. No borrar sus carpetas hasta portar y validar sus funciones utiles y preservar las conexiones independientes. No copiar .env de otro producto encima del de Autopilot ni ejecutar sus migraciones sobre la base de Autopilot.
