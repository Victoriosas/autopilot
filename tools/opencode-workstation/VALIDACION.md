# Validación del puesto OpenCode — 31 de octubre de 2026

## Resultado observado

- OpenCode 1.18.21. OAuth de OpenAI ya existente; respuesta real `OAUTH_OK` con `openai/gpt-6.1-sol`. No se copiaron tokens ni se configuró una API de pago.
- Perfil principal GPT-6.1 Sol: ensayo sintético con prueba inicialmente fallida, lectura, corrección y ejecución de prueba final aprobada. Proceso terminó con código 0. Ver `development-smoke.json`.
- Perfil alternativo Groq/Qwen: lectura, edición y prueba real aprobadas, código 0, 103 segundos. Ver `development-smoke-free.json`. Cuota observada: 1.000 tokens de salida/minuto; perfil acotado a 384 tokens por respuesta y separación de 31 segundos.
- Delegación real director → revisor: leyó un archivo sintético y devolvió el identificador correcto. Código 0. Ver `delegation-smoke.json`. El fixture incluye un commit para que el runtime pueda abrir su sesión de revisión.
- Lanzador de Victoriosas: `consulta` respondió `PERFIL_OK`, código 0. En modo de una sola instrucción se cierra stdin para evitar que espere entrada indefinidamente.
- `opencode debug skill` reconoció las seis skills nuevas y la skill de auditoría ya existente en el proyecto.
- `opencode debug agent ingeniero` confirmó herramientas activas; `debug config` confirmó agentes, comandos, modelos, plugins y servidor LSP.
- `opencode mcp list`: FreeLLMAPI, Context7, navegador y ops conectados. MCP ops consultó el repositorio real de GitHub. MCP Playwright abrió http://127.0.0.1:3000/ y obtuvo el título de Victoriosas. Ver `scripts/check-mcp.mjs`.
- Vercel CLI autenticado como `elmica858-3199`. Esto no acredita acceso a un proyecto concreto ni autoriza producción.
- Salud de Supabase: HTTP 200, GoTrue v2.197.0. No se consultaron tablas ni datos de clientas.
- `node scripts/verify.mjs`: aprobados controles auxiliares de secretos, comandos, esquemas, MCP de lectura, redacción de tokens y perfiles.

## Instalación y límites

Instalados diez perfiles, seis skills, seis comandos y dos plugins; navegador aislado y servidor TypeScript con versiones fijadas. Tres accesos directos: Victoriosas, nuevos proyectos y alternativa Groq. Comando `autopilot-code` disponible en el directorio npm existente. Reglas globales y directivas de Victoriosas separadas; se deshabilitan perfiles antiguos de comercio y ECC en la configuración vigente sin borrar sus archivos históricos.

Supabase MCP está preparado para el proyecto fijo en solo lectura y permanece deshabilitado hasta OAuth propio. Resend y camelRun no tienen claves locales detectadas: el conector informa el bloqueo, no simula autenticación. Las sesiones de ChatGPT no se exportaron. Cerebras conserva su clave válida, deshabilitada por coste no confirmado.

La configuración no crea ejecución permanente de agentes, no activa respuestas a clientas ni modifica la web publicada. No hubo migraciones, DNS, pagos, campañas, envío de correos ni promoción a producción. Las pruebas de modelo usaron solo fixtures sintéticos. La instalación local no hace ilimitadas las cuotas de la cuenta.

## Reproducir

1. `node scripts/verify.mjs`
2. `node scripts/check-mcp.mjs` con la web local en puerto 3000.
3. `node scripts/smoke-development.mjs` para el perfil OAuth.
4. `node scripts/smoke-development.mjs --free` para Groq, respetando su cuota.
5. `node scripts/smoke-delegation.mjs` para delegación.

Los informes registran hechos y estados, sin prompts de clientas ni secretos. El registro del plugin guarda solo fecha y nombre de herramienta; los controles auxiliares no constituyen una sandbox.

Verificación adicional: el LSP TypeScript detectó el error 2322 esperado en un archivo sintético y terminó con código 0 (`lsp-smoke.json`). El instalador de accesos directos se ejecutó correctamente. Se añadió un workflow de validación sin secretos ni llamadas de modelos para los cambios de esta configuración; su resultado remoto debe comprobarse sobre el commit final.
