# Índice de continuidad OpenCode

Objetivo: motor técnico local de Victoriosas con ahorro de tokens obligatorio.
Base de esta ampliación: 2bb43ce; comprobar HEAD y diff antes de actuar.
Configuración: tools/opencode-workstation; política TOKEN_POLICY.md; directivas docs/OPENCODE_DIRECTIVES.md.
Verificado: npm test; respuesta y telemetría reales; estado repetido con cero llamadas a modelos y caché; corrección de código con prueba inicial fallida y final aprobada.
Consumo del ensayo de ingeniería: entrada4867, salida496, razonamiento34, caché leída22784, según OpenCode. No es facturación ni un porcentaje de ahorro.
Siguiente: comprobar CI de PR155 sobre el commit final. No releer todo el historial; localizar solo el tramo necesario en docs/AUTOPILOT_STATE.md.
Accesos pendientes: OAuth de Supabase MCP y claves locales de Resend/camelRun. Cuenta Vercel bloqueada.
Límites vigentes: sin producción, SQL alojado, DNS, pagos ni envíos a clientas. No hay scheduler nuevo. Mantener checkpoint <=1500 caracteres.
