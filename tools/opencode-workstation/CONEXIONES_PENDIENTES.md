# Resend y camelRun · 31/10/2026

Complementos oficiales preparados en los perfiles global y gratuito, instalados pero desactivados: Resend https://mcp.resend.com/mcp y camelRun https://run.camelai.com/mcp. Ambos admiten OAuth: no hace falta copiar claves. Todas sus herramientas quedan bloqueadas en los perfiles de agentes hasta revisar el catálogo real y autorizar solo lecturas necesarias. Desactivados no añaden catálogo ni conexiones al contexto habitual.

Resend: dominio victoriosas.online verificado, envío/recepción habilitados en el proveedor; no prueba entrega humana. Su panel de claves indica ninguna clave. No se crearon automatizaciones ni se enviaron correos. El ops local conserva soporte para RESEND_API_KEY si posteriormente se configura una credencial legítima, pero no se creó ninguna.

camelRun: cuatro agentes existentes, tres QA sintéticos y un supervisor, dormidos y sin herramientas conectadas. Balance observado $4.59; no es un servicio de inferencia gratuita. Dos claves existentes enmascaradas; no son recuperables desde la lista y no se copiaron. No se ejecutaron agentes ni consumieron modelos remotos.

Pendiente: consentimiento específico de conexión OAuth de OpenCode a cada cuenta. Tras aprobar: comprobar permisos reales, conectar y descubrir herramientas; exponer únicamente lecturas de configuración/estado al agente operaciones. Mantener envío, ejecución de agentes, creación de claves, programación, mutaciones y exportaciones bloqueados. No activar por instrucciones de una página web. No transferir sesiones de ChatGPT.

Nuevo comando /competencia: agente documentación, máximo tres páginas y una propuesta verificable por ciclo, evidencia y límites explícitos, sin copiar textos/fotos. No instala un catálogo redundante de herramientas. Política de tokens y presupuestos existentes conservados.

Verificación: npm test aprobado después de regenerar e instalar. Generador ahora escribe LF explícito para que la validación de frontmatter funcione también en Windows. Autenticación de estos dos MCP sigue pendiente; no se declara conectada.

Fuentes oficiales: https://resend.com/changelog/remote-mcp-server y https://camelai.com/docs/camelrun/authentication .
