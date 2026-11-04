# Estabilización de consultas · 04/11/2026

## Formulario: evidencia y alcance

- Base productiva contrastada: `33f718e3e5894a2a459f5e279d5092be97774320`, Vercel READY, dominio `victoriosas.online`, proyecto `autopilot`/equipo `autopilot12`.
- Navegador aislado: `/consultanos` devuelve HTTP 403 con desafío Cloudflare. GET de `/api/beauty/inquiries/config`, con las opciones originales del componente, devuelve 403, `Content-Type: text/html`, `cf-mitigated: challenge`, en 192 ms. No hubo POST productivo. Los errores de consola observados pertenecen al desafío; no prueban un fallo de React.
- Causa local demostrada: `credentials: omit` descarta las cookies de verificación de un visitante que ya superó la protección. El fixture con cookie HttpOnly y API protegida reproduce el bloqueo con el componente original (timeout de disponibilidad). Con `same-origin`, config y POST conservan esa cookie. No se cambia Cloudflare, CORS, autenticación ni autorización del servidor.
- Límite: esta sesión no superó el desafío inicial de producción. La incompatibilidad con cookies está probada localmente; no se afirma que sea la única causa del incidente original ni que producción ya esté corregida.
- Prueba: `scripts/test-consultation-form-browser.ts` usa el componente real, React StrictMode, servidor Express/router real y navegador en loopback. Escritorio 1280 px y móvil 390 px: disponibilidad, cookie en GET/POST, consentimiento nativo, rechazo de origen, bloqueo cuando config no habilita y reintento. Store/avisos son fixtures; no acredita persistencia Supabase ni entrega Resend. Ninguna petición externa puede salir del navegador.

## Integraciones observadas en lectura

- MCP camelRun nativo y dos conectores de aplicación autenticados; Supabase de Victoriosas autenticado. No se compartieron sus credenciales con la aplicación.
- Resend: `victoriosas.online` verificado, envío/recepción habilitados. No se leyeron mensajes ni se envió correo.
- Vercel: nombres/presencia/alcance de variables revisados con `decrypt=false`; secretos nunca impresos ni copiados. Variables de consultas/camelRun/Resend presentes en producción; no implica configuración válida en previews ni entrega real.
- Las tres pruebas sintéticas históricas del laboratorio reportan costo de modelo cero. La [tarifa oficial de camelRun](https://run.camelai.com/docs/pricing.md) cobra tiempo de agente (US$0,01/h) y almacenamiento (US$0,10/GB-mes). No hay evidencia de exención de esta cuenta. **Costo total cero no demostrado: no ejecutar modelos remotos ni habilitar el proveedor.**

## Matriz de seis etapas

| Etapa | Evidencia de esta misión |
| --- | --- |
| Renderizado | Componente real probado localmente; producción bloqueada por desafío |
| Configuración GET | Contrato válido local; 403 HTML en navegador productivo |
| POST | Sintético local; rechazo de origen y conservación de cookie |
| Persistencia | No probada por este fixture; requiere PostgreSQL/Auth aislados |
| Aviso Resend | Cero envíos; dominio verificado no demuestra recepción |
| Lectura admin | No se consultaron expedientes; pendiente recorrido Auth aislado |

No se ejecutaron modelos ni se modificaron secretos, DNS, pagos, configuraciones alojadas o datos de clientes.
