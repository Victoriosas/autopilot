# Continuidad OpenCode · 31/10/2026
Objetivo: motor local de Victoriosas con economía de tokens obligatoria.
Código: tools/opencode-workstation; política TOKEN_POLICY.md; directivas docs/OPENCODE_DIRECTIVES.md.
Base previa8d7e3c3; comprobar HEAD/diff y CI actual. No releer todo el historial.
OAuth camelRun autenticado y MCP conectado; ensayo nativo exit0: camelrun_list_agents devolvió4, sin ejecutar agentes remotos. Flag --camelrun exige repositorio Victoriosas y perfil operaciones; solo inventario permitido y carga bajo demanda. Evidencia camelrun-smoke.json.
Resend desactivado/no autenticado: auto-review bloqueó callback Full access por alcance leer/crear/eliminar. Requiere consentimiento específico antes de retomar; no eludir por CLI u otro navegador. Detalles CONEXIONES_PENDIENTES.md.
Pruebas npm test incluyen límites de rol/repositorio/permiso; instalación actualizada con backup. Config por defecto mantiene MCP opcionales apagados.
PR156 web independiente:382/382, builds y navegador comprobados; consultar CI final. Sin producción, SQL alojado, DNS, pagos ni envíos. Cuenta Vercel bloqueada. Sin scheduler nuevo.
