# Conexiones OAuth · 31/10/2026

## camelRun
Autenticación OAuth confirmada por OpenCode y conexión MCP verificada con el cliente nativo. Inventario mediante camelrun_list_agents: cuatro agentes. No se llamó run_agent, no se crearon agentes, claves, tareas ni horarios y no se ejecutó inferencia en camelRun.

Disponible bajo demanda: autopilot-code --project C:\autopilot-worktrees\opencode-workstation-20261031 --agent operaciones --camelrun . El flag solo acepta el repositorio Victoriosas/autopilot y el perfil operaciones; otros proyectos/roles fallan antes de activar. Se habilita únicamente camelrun_list_agents; el resto permanece denegado. No se carga el catálogo remoto en sesiones normales, para ahorrar tokens. La concesión OAuth del proveedor es más amplia que estos permisos locales; los bloqueos locales no reducen el alcance del token en el proveedor.

## Resend
Continúa desactivado y sin autenticación local confirmada. El panel OAuth ofrece Full access (leer, crear y eliminar recursos) o Sending access; no ofrece solo lectura. El control automático de Browser rechazó observar/finalizar el callback de Full access porque consideró ese alcance superior a la autorización de uso en lectura. No se reintentó por otra superficie ni se copió una clave. Hace falta autorización explícita de Full access del proveedor antes de retomar. Cualquier autorización posterior debe conservar envíos y mutaciones bloqueados en OpenCode.

Dominio victoriosas.online verificado; el panel de claves no mostraba API keys. No se enviaron mensajes ni crearon automatizaciones. El soporte local ops para RESEND_API_KEY se conserva sin credencial nueva.

## Operación
Los cuatro agentes camelRun estaban dormidos y sin herramientas conectadas. Balance observado $4.59: no se supone inferencia gratuita. El comando /competencia mantiene máximo tres fuentes y una propuesta por ciclo. Context7, navegador aislado y ops existentes siguen separados; no se exportan sesiones de ChatGPT.

Pruebas: npm test incluye control de repositorio/rol, permisos y orden deny/allow; instalación con backup. Evidencia del ensayo nativo en camelrun-smoke.json. No confundir metadatos de conexión con ejecución de agentes o prueba de correo.

Fuentes oficiales: https://camelai.com/docs/camelrun/authentication y https://resend.com/changelog/remote-mcp-server .
