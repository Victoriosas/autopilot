# Supabase Cron → pg_net → Edge: preparación aislada

Fecha: 2026-11-22. Base inicial: main 82b6fb24.
Estado: **CÓDIGO PREPARADO, NO DESPLEGADO NI PROGRAMADO**.

## Propósito
Preparar para una fase posterior el transporte alojado independiente de GitHub Actions.
No crear otro planificador, cola, supervisor ni ejecutor: reutilizar el motor existente.

## Componentes
- `src/autopilot/directorWake.ts`: preflight sin efectos que exige token scoped.
- `src/autopilot/directorWake.test.ts`: negativos y contrato sin ejecución.
- `supabase/functions/autopilot-director-wake/index.ts`: punto de entrada Deno.
- `supabase/staged/autopilot_director_wake_cron_REVIEW_ONLY.sql`: SQL comentado.

## Invariantes
- Sin secreto, token incorrecto, ruta/método errado: denegación.
- Respuesta válida: `executed=false`, `tasksClaimed=0`, `noSend=true`.
- Nunca leer datos personales, enviar mensajes ni reclamar tareas.
- No presentar HTTP 200 como heartbeat durable ni prueba de autonomía.
- No instalar `pg_net`, crear Cron, configurar secreto, desplegar Edge Function
  ni escribir en Supabase alojado sin autorización posterior específica.
- No usar service_role como token de invocación HTTP.
- Revisar PR #272 y P2 antes de implementar claims de director.

## Próximo paso después de revisión
En un entorno aislado, desplegar endpoint preflight, probar 401/503/200
y llamada programada con `pg_net`, sin secretos en logs.
Solo después añadir claim dedicado y acotado para `director`, autorización
por efecto, verificador independiente y recibos de ejecución durables.
Este cambio **no** satisface el criterio de autonomía operativa.

## Incremento verificado · 22/11/2026

### Entrada Deno real

Se añadió `scripts/test-director-wake-deno.ts` y el comando
`npm run test:director-wake:deno`. El ensayo usó Deno real 2.2.7 instalado
solo dentro de `.lab-tools/deno` con caché npm exclusiva; no modifica `PATH` ni usa
credenciales alojadas. Preparación reproducible: `npm install --prefix
.lab-tools/deno deno-bin@latest` seguida de `npm run test:director-wake:deno`. Ejecuta el verdadero `Deno.serve` del archivo Edge real
y HTTP loopback a `127.0.0.1:8000` con una credencial sintética efímera:

- GET: `405`.
- Ruta falsa: `404`.
- Token incorrecto: `401`.
- Sin configuración: `503`.
- Token correcto: `200` con `executed=false`, `tasksClaimed=0`, `noSend=true`.

### Laboratorio PostgreSQL pg_cron/pg_net

Estado observado y final: `NOT_EXECUTED/blocked_lab`. Se probó un clúster
PostgreSQL 18.3 nativo desechable en `127.0.0.1:55432`, iniciado con SCRAM y una
contraseña aleatoria efímera, y detenido inmediatamente. La consulta de
`pg_available_extensions` devolvió cero filas para `pg_cron`, `pg_net`, `vault`
y `pgsodium`. Por tanto no existían herramientas ni extensiones compatibles para
crear el cron de demo. El clúster completo y su contraseña fueron eliminados.
En este entorno no existe Docker y no hay un contenedor ajeno permitido.
No se conectó al proyecto alojado ni se activó ninguna extensión remota.

Si se autoriza más adelante un laboratorio aislado, el procedimiento mínimo es:
1. Crear clúster temporal propio, contraseña aleatoria y puerto loopback.
2. Ejecutar `SELECT * FROM pg_available_extensions WHERE name IN
   ('pg_cron','pg_net','vault','pgsodium')`.
3. Si faltan extensiones o no son compatibles: conservar `NOT_EXECUTED`.
4. Si están disponibles: instalar solo en el clúster desechable, no en una base
   existente, crear una sola fila Cron con nombre fijo de demo y llamar a un
   receptor loopback sintético.
5. Verificar antes una fila única: `SELECT jobname, jobid FROM cron.job WHERE
   jobname='autopilot-director-wake-preflight-demo'`; rechazar si ya existe.
6. Después verificar exactamente una ejecución y desinstalar primero Cron,
   luego el receptor/secretos temporales y finalmente las extensiones con
   dependencias compatibles. Detener y eliminar el clúster completo.

Controles de duplicados: nombre fijo, consulta previa, verificación posterior de
una sola fila y `cron.unschedule(...)` exacto. No existe servicio diario ni
scheduler adicional. La prueba no envía ni reclama tareas.

### Riesgo temporal de encabezados en pg_net

`pg_net` puede almacenar temporalmente solicitudes HTTP, encabezados y metadatos
en su cola antes de confirmar el envío. Estos datos deben tratarse como sensibles:
restringir privilegios de esquema/tabla a roles mínimos, mantener tiempo de
retención corto compatible con el runtime, rotar el token scoped y verificar
limpieza de entradas. No cargar jamás `service_role`, claves reales, datos de
clientas ni mensajes en ese encabezado o cuerpo. Esta PR conserva solo un token
sintético efímero; las claves reales quedan fuera de Git, logs e instalaciones.

## Referencias
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/database/extensions/pg_net
- https://supabase.com/changelog.md


## Revisión aislada adicional · 22/11/2026

La revisión de la PR #273 corrigió el uso de `endsWith` para autorizar
rutas de invocación. Ahora solo se admiten las dos rutas exactas del
endpoint; variantes con prefijos, sufijos, capitalización diferente o
segmentos codificados no autorizan el preflight.

La prueba `src/autopilot/directorWakeEntry.test.ts` importa el punto de
entrada real de Edge con un shim Deno limitado y lo invoca por HTTP
loopback. Resultado: 5/5 pruebas del puente; `npm run verify` final:
619/619 tests, TypeScript, builds de Node/Vercel y smoke de API aprobados.

**Límite de evidencia:** la prueba Deno real se hizo localmente sobre loopback;
no se desplegó en Supabase Edge alojado ni se creó un job Cron. El ejecutor
`director` alojado sigue inexistente y no se acredita autonomía operativa.

## Registro local de agentes · 22/11/2026

La ruta protegida `GET /api/v4/agents` ahora proyecta los seis IDs canónicos
de `sixAgentControlPlane` y no los cinco perfiles comerciales heredados.
`director` solo declara `read`/`analyze`; código, ramas, publicación, compras,
reembolsos, secretos y despliegues quedan como acciones sujetas a revisión
humana. Para los seis roles el registro deja `enabled=false`,
`runtimeStatus=not_proven` y `noSend=true`. Son valores de configuración API;
no activan el worker ni certifican el estado del proveedor.

Prueba RED inicial: la ruta listaba `discovery-agent`, `pricing-agent`,
`purchasing-agent`, `opencode-worker` y `codex-governor`, y marcaba algunos
como enabled sin evidencia de ejecución. GREEN: `agentRegistry.test.ts` pasa
4/4, confirma los IDs compartidos, scopes de director, cierre de ejecución y
copias defensivas. `npm run verify` pasa 623/623 (0 fallos/omitidas), con
TypeScript, builds Node/Vercel y smoke de API; `node scripts/secret-scan.mjs`
y `git diff --check` pasan. La ruta permanece detrás de la autenticación
existente de `createAutopilotV4Router`.

Esto corrige solo el registro/API local. No aplica la configuración a la
base alojada, no añade tareas ni claims, no instala extensiones, no crea Cron,
no despliega la Edge Function y no demuestra un worker autónomo. CI remoto
sigue sujeto al bloqueo de cuenta de GitHub por facturación registrado en la
PR #272.
