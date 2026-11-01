# Revision integrada en la PC · 29/10/2026

Integra PR148 y PR151 (74518ed), mas PR150 (0e2b1cb), en la rama codex/integration-local-20261029. El unico conflicto fue el apendice de docs/AUTOPILOT_STATE.md; se conservaron ambas continuidades. No se modificaron worktrees ajenos ni archivos sin seguimiento de C:/autopilot.

## Probar

- Carpeta: C:/autopilot-worktrees/integracion-local-20261029.
- Ejecutar: powershell.exe -NoProfile -File scripts/start-local-review.ps1 desde esa carpeta.
- Abrir http://127.0.0.1:3000 en la misma PC.
- Articulos y preguntas nuevas son visibles como borradores en desarrollo; no estan publicados.
- Detener con Ctrl+C en la consola del servidor. El servidor depende de que la PC siga encendida.

El lanzador usa solo loopback, rechaza archivos .env/.env.local y limpia credenciales relevantes exclusivamente del proceso hijo. No copia secretos desde otra instalacion. Captura de consultas, correo, modelos, sourcing y pagos quedan cerrados. No permite comprobar recepcion real ni administracion alojada sin su configuracion; es una revision local del producto, no una replica de la base productiva.

## Evidencia

npm ci completado. npm run verify del conjunto:381/381 sin fallos ni omisiones, tipos y builds servidor/Vercel aprobados. Directorio3/3 por separado; check-route-html y secret-scan aprobados. API health HTTP200/status:ok/checkoutEnabled:false; inquiries/config enabled:false, privacidad v1 y retencion30d. Listener confirmado 127.0.0.1:3000.

Navegador Chrome conectado a la PC: portada, menu, indice14articulos, lectura de limpieza de cutis, encabezados/servicios relacionados y contacto contextual comprobados sin abrir WhatsApp ni enviar mensajes. No acredita prueba integral de administracion, correo o IA. No se promueve preview ni se cambia main/produccion; la integracion local queda sincronizada en una PR para la revision solicitada.
