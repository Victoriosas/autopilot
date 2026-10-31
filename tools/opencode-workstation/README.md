# OpenCode Autopilot: configuración local

Configuración del puesto de desarrollo de Victoriosas, reutilizable en otros proyectos. GPT-6.1 Sol por la autenticación OAuth ya existente de OpenCode es el perfil principal, después de verificar una respuesta real. FreeLLMAPI/Groq queda como alternativa explícita. No se copiaron tokens ni se contrató otro servicio. No cambia la aplicación publicada ni transfiere las sesiones o complementos privados de ChatGPT.

## Instalar y abrir

Requiere OpenCode 1.18.21, Node, Git, GitHub CLI autenticado y FreeLLMAPI local. Desde este directorio ejecutar `npm ci --ignore-scripts` y `node scripts/install.mjs`. En Windows, `scripts/install-shortcuts.ps1` reproduce los accesos directos y el comando `autopilot-code`. El instalador guarda una copia de los archivos reemplazados fuera del repositorio. Las credenciales se resuelven por variables locales, nunca se incluyen en estos archivos.

Abrir con `node scripts/start.mjs --project C:\ruta\proyecto`. Para una tarea breve: añadir `--agent ingeniero --prompt "objetivo concreto"`. Añadir `--free` para utilizar Groq con sus límites en lugar de OAuth. El lanzador aplica el perfil vigente incluso si un proyecto conserva una configuración antigua. Comprueba el remoto para activar las directivas de Victoriosas; otro repositorio recibe las reglas generales.

`scripts/start-gateway.ps1` inicia exclusivamente la instalación existente en 127.0.0.1:3001 si no responde. No instala otro servidor, no abre puertos ni compra modelos. Los accesos directos del escritorio abren el perfil; no mantienen un agente trabajando tras cerrarlo.

## Capacidades

10 perfiles: ingeniero, director, arquitecto, revisor, seguridad, datos, QA, operaciones, documentación y consulta. El director delega secuencialmente. Las revisiones no tienen herramientas de edición. Seis skills se cargan a demanda, y seis comandos: `/ciclo`, `/auditar`, `/estado`, `/verificar`, `/nuevo-proyecto`, `/retomar`.

MCP FreeLLMAPI para diagnóstico; Context7 para documentación; Playwright 0.0.83 con Chrome aislado para QA; MCP propio `ops` en lectura para GitHub, Vercel, salud de Supabase y dominios de Resend. La presencia de variables de camelRun se informa, pero no se simula una conexión operativa. Cada servicio requiere sus permisos locales. El diagnóstico de Vercel debe verificar cuenta/equipo/proyecto: puede diferir de la cuenta utilizada antes.

Los MCP se conectan al iniciar, pero sus herramientas solo se exponen a los perfiles relevantes. No se incluyen operaciones de envío, SQL alojado, administración de claves ni publicación. Context7 puede imponer cuota o pedir credenciales; no se compran créditos. El navegador de QA no hereda sesiones personales.

Los plugins locales compactan descripciones en el perfil `--free` sin alterar esquemas y añaden controles para rutas de secretos y comandos destructivos evidentes. El perfil OAuth conserva las descripciones completas y los límites nativos del modelo. Hay un servidor LSP TypeScript/JavaScript instalado con versiones fijadas. El registro guarda solo fecha y nombre de herramienta. Son controles auxiliares, **no una sandbox ni una garantía de interceptar cualquier acceso realizado por una shell**. La shell arbitraria requiere revisión; no conceder permiso global permanente. No cargar datos personales en modelos gratuitos.

## Modelos y límites

El perfil principal usa `openai/gpt-6.1-sol` mediante el OAuth nativo guardado; la disponibilidad y las cuotas siguen siendo las de esa cuenta. No se configura una clave API de pago ni se garantiza uso ilimitado. Las credenciales OAuth no se exportan. Solo OpenAI y FreeLLMAPI quedan habilitados como proveedores.

El perfil `--free` usa Qwen 3.8 27B y permite elegir GPT OSS 20B/120B por FreeLLMAPI/Groq. No se usan nombres de Claude para simular un modelo de Anthropic. Un límite operativo conservador de 8K reduce contexto; no representa la capacidad máxima del modelo. Se observó un límite de cuenta de 1000 tokens de salida/minuto: las respuestas de Groq se acotan a 384 tokens y las llamadas por modelo se espacian 31 segundos. Esto reduce velocidad y obliga a escribir código por partes, pero evita configurar un máximo superior a la cuota. Las cuotas diarias siguen siendo del proveedor. Ante 429 guardar checkpoint y respetar espera; no hacer rotación de claves para evadir límites. Cerebras permanece deshabilitado: su crédito temporal no acredita gratuidad permanente.

Supabase MCP está preparado en el perfil de Victoriosas con proyecto fijo, solo lectura y herramientas de metadatos, pero permanece deshabilitado hasta autenticarlo mediante `opencode mcp auth supabase`. Las consultas SQL y los logs no se autorizan por este perfil. Resend y camelRun requieren credenciales locales que no se encontraron; se informa ese bloqueo y no se copian claves de producción ni sesiones de ChatGPT.

## Ahorro y motor de control

`TOKEN_POLICY.md` es una instrucción permanente y breve: buscar antes de leer, cargar skills a demanda, no repetir pruebas sin cambios y dejar checkpoints de hasta 1500 caracteres. El lanzador evita cargar explícitamente AGENTS.md (OpenCode lo descubre) y utiliza una sola copia de las directivas de Victoriosas. Las rutas de reglas globales coinciden con las instaladas para evitar variantes duplicadas. Las descripciones compactas de herramientas son el modo normal; `--deep` conserva el detalle.

El plugin `token-economy` acota lecturas, respuestas solicitadas, tamaño de salidas y delegaciones. Cuenta solicitudes observadas en `chat.params` y telemetría de mensajes terminados, deduplicada por mensaje. Presupuesto normal: 16 solicitudes al hook, 3 delegaciones y volumen conservador reportado de 90000 tokens por sesión. Los límites se aplican a los hooks que invoque el runtime; no son una garantía de facturación ni interceptan peticiones externas al proceso. Los límites de pasos del agente siguen activos. `--deep` amplía conscientemente el presupuesto para casos complejos.

`autopilot-control status --project C:\ruta\repo` inspecciona Git y la salud local **sin modelo**. Reutiliza un snapshot durante 60 segundos si el commit y los archivos no cambiaron; siempre muestra la fecha y `cacheHit`. `--refresh` fuerza una observación. `autopilot-control tokens` informa contadores locales; sin telemetría devuelve desconocido, no cero inventado. No almacena prompts, código, contenido de herramientas ni credenciales.

`autopilot-control mission --project C:\ruta\repo "objetivo concreto"` inicia una unidad de trabajo con el director, snapshot compacto y un límite de tiempo de doce minutos. No genera tareas automáticamente, no repite misiones por su cuenta ni crea un servicio 24/7. Al alcanzar un límite se debe inspeccionar el diff y retomar desde evidencia. El motor puede observar, priorizar, desarrollar localmente y verificar; los permisos productivos y la supervisión comercial siguen vigentes.

Las salidas recortadas indican qué se omitió y retienen inicio y final; pedir rangos adicionales si una validación los necesita. El ahorro medido en caracteres no equivale a un porcentaje exacto de tokens ni a dinero ahorrado. El reporte mantiene entrada, salida, razonamiento y caché separados.

### Comprobaciones

`npm test` comprueba políticas, MCP, perfiles, presupuesto, deduplicación de consumo y caché del control sin red. `opencode debug agent ingeniero`, `opencode debug skill` y `opencode mcp list` acreditan carga/conexión. Las pruebas reales de modelo y herramientas se documentan por separado: una configuración válida no demuestra edición ni delegación exitosas.

Para recuperar configuración anterior, cerrar OpenCode y restaurar los archivos de la carpeta más reciente en `~/.local/state/opencode-autopilot/backups`. No restaurar claves desde un repositorio. Deshabilitar un MCP con `enabled:false` o quitar el plugin instalado en `~/.config/opencode/plugins` si es necesario.

Documentación oficial consultada: https://opencode.ai/docs/config/ , https://opencode.ai/docs/agents/ , https://opencode.ai/docs/skills/ , https://opencode.ai/docs/plugins/ , https://opencode.ai/docs/mcp-servers/ .

### Inventario camelRun bajo demanda

OAuth verificado, sin copiar API keys. Para inventario desde el repositorio Victoriosas: `autopilot-code --project C:\autopilot-worktrees\opencode-workstation-20261031 --agent operaciones --camelrun`. Solo se permite `camelrun_list_agents`; las demás herramientas siguen bloqueadas. En sesiones normales no se conecta este MCP. Otros proyectos/roles se rechazan. Resend autenticado: --resend activa solo resend_list-domains bajo las mismas restricciones. El equipo devuelve0dominios; conciliar la cuenta antes de configurar correo. Ver CONEXIONES_PENDIENTES.md.
