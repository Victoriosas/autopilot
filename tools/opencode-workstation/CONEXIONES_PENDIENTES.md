# Conexiones OAuth · 31/10/2026

camelRun y Resend autenticados en OpenCode. Las concesiones OAuth del proveedor pueden ser más amplias que los permisos locales; los bloqueos de OpenCode no reducen el alcance del token. No se copiaron secretos al chat ni a Git.

Disponibles bajo demanda desde el repositorio Victoriosas/autopilot con el agente operaciones: --camelrun habilita únicamente camelrun_list_agents; --resend habilita únicamente resend_list-domains. Cualquier otro repositorio/rol se rechaza. El resto de herramientas de cada proveedor permanece denegado; sin envío, creación, borrado, programación o ejecución de agentes. Configuración por defecto mantiene ambos servidores apagados para ahorrar contexto.

Prueba camelRun nativa exit0: inventario4. Prueba Resend nativa exit0: dominios0. El equipo/cuenta autorizado en el navegador no muestra el dominio verificado que reportaba el conector ChatGPT anterior; se requiere conciliar cuenta/equipo antes de configurar correo. No crear dominio duplicado ni modificar DNS para ocultar esta diferencia. Sin prueba de entregabilidad.

Resend inicialmente bloqueado por auto-review al no existir autorización explícita de Full access; el propietario la otorgó después. El flujo OAuth terminó correctamente según cliente nativo. Primer ensayo usó nombre de herramienta con guion bajo y no encontró herramienta; se corrigió al nombre real del catálogo (list-domains) y se repitió. Los archivos resend-smoke.json y camelrun-smoke.json registran el resultado real.

npm test incluye pruebas de alcance, permisos y orden deny/allow. Instalación actualizada con backup. No se usaron modelos de camelRun ni se consumió su saldo; el ensayo de OpenCode usa la conexión nativa ya configurada. No se enviaron correos, crearon API keys, automatizaciones o agentes.

Prompt de rediseño: docs/OPENCODE_REDESIGN_BRIEF.md, navegación real por páginas en rama independiente. /competencia conserva máximo tres fuentes y una propuesta por ciclo.
