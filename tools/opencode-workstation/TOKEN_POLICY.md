# Economía de tokens: regla operativa

Resolver el objetivo con el mínimo contexto suficiente y mantener la validación necesaria. No ahorrar omitiendo seguridad, un fallo relevante o una comprobación requerida.

1. Leer AGENTS.md y un checkpoint corto. Buscar nombres/rangos con glob/grep antes de leer archivos. Primera lectura: 100 líneas; máximo normal 160. No cargar historiales completos, lockfiles, artefactos, capturas ni directorios enteros por defecto.
2. Mantener estables las reglas y el proveedor para favorecer la reutilización de caché. Cargar una skill solo si aporta información a la tarea. No copiar el mismo documento en varias instrucciones.
3. Usar una herramienta especializada o un script determinista antes que un modelo cuando baste. `autopilot-control status` y `autopilot-control tokens` no llaman al modelo. Consultar el estado cacheado con su fecha; usar `--refresh` si importa la actualidad.
4. Trabajar por cambios pequeños. Leer solo los archivos afectados. Preferir edit/patch a reescribir archivos enteros. No reproducir código, logs o planes largos en el chat si ya están guardados.
5. No formar un comité por defecto. Delegar únicamente una tarea independiente con objetivo, archivos y aceptación. Máximo tres delegaciones por sesión; sin delegación recursiva. Reutilizar sus hallazgos. Director coordina; no repite la implementación.
6. Ejecutar las pruebas proporcionales una vez por estado del código. Repetir solo si cambió algo relevante, falló la prueba o queda una duda concreta. Un error distinto justifica diagnóstico, no reintentos idénticos ilimitados.
7. Respuestas breves: resultado, evidencia, pendiente. Tope solicitado por rol: consulta 256, director/operaciones 768, revisión/QA 1024, ingeniería/documentación 1536 tokens. Groq conserva 384. Dividir cambios grandes; no truncar código silenciosamente.
8. Salidas de herramientas extensas se acotan a 8000 caracteres con aviso, inicio y final. Si falta evidencia, solicitar el rango omitido; nunca afirmar haber revisado lo que no se recibió.
9. Presupuesto normal por sesión: hasta 16 solicitudes al hook y 90000 tokens de volumen reportado conservador. Guardar checkpoint antes de agotar. La telemetría distingue entrada, salida, razonamiento y caché; si el runtime no informa consumo, mostrar desconocido. No confundir estos contadores con facturación ni ahorro exacto.
10. `--deep` amplía conscientemente el presupuesto y el detalle para problemas que lo necesiten; no es el modo habitual. No activar proveedores pagos, rotar claves para evadir cuotas ni sustituir una prueba fallida por una respuesta corta.

Usar docs/OPENCODE_CHECKPOINT.md como índice de continuidad de hasta 1500 caracteres: objetivo, commit/base, archivos cambiados, pruebas y resultado, bloqueo y siguiente acción. Es un índice al registro histórico, no otra fuente de verdad. No incluir secretos, datos de clientas, conversación completa ni razonamiento privado. Antes de retomar, comprobar si el código cambió.

OpenCode es el motor técnico local complementario de Victoriosas. Puede observar, priorizar, implementar localmente, verificar y preparar una PR dentro de su autorización. Producción, DNS, SQL alojado, pagos y envío a clientas conservan sus controles. Un perfil o checkpoint no crea ejecución permanente.
