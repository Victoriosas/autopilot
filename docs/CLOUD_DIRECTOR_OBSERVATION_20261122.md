# Cloud Director: inventario y observación operativa · 22/11/2026

## Alcance y veredicto
Fase F0: base de verdad. Incremento de observación sobre el sistema existente, no un segundo Director, ledger, cola o scheduler. **Autonomía cloud completa: NO demostrada.** No activa misiones, modelos, envíos, SQL alojado, cron ni desarrollo autónomo.

## 1. Infraestructura y accesos
- Lectura del proyecto Vercel y del repositorio GitHub verificada. Integración: `Victoriosas/autopilot`, producción `main`.
- Main al iniciar: `82b6fb24e76d81e5026c94af2630358d00f2ebe9`.
- Último despliegue de tipo Production listado: READY, SHA `9d6bbdb5f7c7200fe62463cd904314edbb9f86f0`; no equivale a verificar el alias actual ni el runtime. Existe brecha respecto de main; este trabajo no la promueve.
- PR #272: abierta, no draft, no fusionada; head `cb67032cd2319b622f5868590e14dc291c1ce001`. PR #273: abierta, actualmente no draft, no fusionada; head `009713fc5e444176bf97f8e7ffa3287b4ae849c4`.
- Checks actuales de ambas: validate/postgres fallan; Vercel tiene checks exitosos; Supabase Preview omitido. Sus descripciones atribuyen los fallos Actions a facturación; no se obtuvo un log del job consultado, por lo que esa causa no se revalida aquí.
- No se dispone de una consulta SQL/Supabase remota desde esta sesión. No se exportaron credenciales ni se consultaron datos de clientes.

## 2. Arquitectura encontrada e incremento
React 19/Vite 8, Express, Node 24, función API compilada por esbuild; Supabase Auth y PostgREST/PostgreSQL. `vercel.json` reescribe `/api/*` a la función servidor.

Reutilizables: `sixAgentControlPlane`, `sixAgentPersistence`, `LocalMissionStore`, `CloudMissionStore`, `missionRuntime`, `missionAuthorization`, `permanentSupervisor`, `cloudLedgerHandoff` y el panel administrativo existente. No se sustituyen sus autorizaciones ni sus invariantes.

El incremento añade una proyección determinista del ledger, integrada en `agents-status` y la oficina de agentes. Solo lectura. No es el ciclo persistente completo del Cloud Director Core.

## 3. Archivos
- `src/autopilot/agentObservation.ts`: proyección sin datos sensibles.
- `src/autopilot/agentObservation.test.ts`: leases, evidencia, roles y tiempos.
- `src/autopilot/sixAgentStatusRouter.ts`: integra observación; conserva autenticación administrativa; respuesta no-store.
- `src/autopilot/sixAgentStatusRouter.test.ts`: HTTP 401/403/200/503, acceso mínimo y no divulgación.
- `src/components/admin/SixAgentStatusPanel.tsx`: claims vigentes/vencidos, evidencia declarada, disponibilidad desconocida, consumo no medido y zona America/Montevideo.
- Este informe y la entrada fechada en `AUTOPILOT_STATE.md`.

## 4. Integraciones funcionales
La integración Vercel–GitHub está verificada por metadatos y lectura del código. El endpoint conserva el adaptador Supabase existente: su contrato se prueba con proveedor sintético, **no** con el servicio alojado. La presencia de un conector no demuestra sus permisos efectivos ni una consulta exitosa.

## 5. Validaciones
Reproducción del problema anterior por inspección: contaba cualquier fila `running`, sin evaluar `lease_until`; cualquier evidencia truthy se presentaba como verificada en la interfaz.

Pruebas focales: 5 aprobadas, cero fallos/omisiones. Incluyen lease vencida/al límite/ausente/inválida, fecha futura, orden de filas, evidencia vacía, rol desconocido, secreto centinela, rechazo anónimo/no-admin y errores saneados. La primera ejecución del nuevo archivo falló porque el módulo aún no existía: no se presenta como una reproducción RED del código anterior.

`npm run verify` completó tipos, builds Node/Vercel y smoke de API compilada: 619 tests, 618 aprobados, cero fallos y una omisión existente (preparación offline de Supabase). `node scripts/secret-scan.mjs` y `git diff --check` aprobaron. La CI remota del candidato debe consultarse en su PR. No heredar los resultados históricos de otras PR. No hay migración SQL en este cambio ni prueba PostgreSQL alojada.

## 6. Ciclo de supervisión
No se ejecutó un ciclo alojado del Director. El GET administrativo consulta como máximo las últimas 500 tareas, no escribe checkpoints ni adquiere lease global. Los conteos son de una ventana, no totales globales. Claims vigentes acreditan propiedad temporal del ledger, no actividad real del worker. Ninguna tarea se reanuda ni reclama desde este observador.

## 7. Seis agentes reales
| ID | Función del panel existente | Configuración estática | Disponibilidad actual |
|---|---|---|---|
| director | Director Autopilot | ready | unknown |
| software | Ingeniero de software | ready | unknown |
| infrastructure | Auditor de infraestructura | ready | unknown |
| consultations | Asistente de consultas | degraded | unknown |
| followup | Seguimiento operativo | ready | unknown |
| reports | Informes y auditoría | ready | unknown |

Los disparadores están definidos en `SIX_AGENTS`. No hay heartbeat verificable en esta lectura. No se inventan `ready`, `running`, `offline`, misión actual/siguiente, costos ni última ejecución real a partir de esos valores estáticos. Las últimas escrituras no equivalen a ejecuciones confirmadas. Una evidencia declarada tampoco acredita el resultado de la misión.

## 8. Ledger y recuperación
`CloudMissionStore` ya existe: transporte TLS con identidad/entorno aislado fijados, sin provisión ni admisión cloud. El workflow `plan-cloud.yml` conserva la barrera fija `cloud_ledger_adapter_not_configured` para la continuación por `workflow_run`; sus modos hosted explícitos son una ruta distinta. La causa no se resuelve borrando la barrera: falta atar la continuación a configuración autorizada, revisión de SHA, secretos y entorno protegido, y demostrar recuperación mediante el ledger real.

El incremento no modifica SQL, RLS, fencing, tokens, reintentos, políticas ni el recibo P2 preservado. #272 contiene una corrección de fencing pendiente de integración/revisión; no se incorpora silenciosamente ni se activa un worker antes de revisarla.

## 9. Preview y navegador
La PR debe enlazar el Preview del SHA exacto. El panel necesita sesión Supabase con perfil admin. Se revisaron AGENTS.md, README.md, DEPLOY.md, el componente administrativo y App.tsx; no hay una cuenta de pruebas documentada utilizable aquí. No se añade bypass ni se copian secretos productivos para una captura. Sin entorno aislado configurado y acceso admin de prueba, el panel queda sin validación visual/desplegada con datos reales.

## 10. Pendientes y configuración mínima
- Almacenamiento no productivo autorizado con esquema y funciones existentes verificados; su URL, clave pública y credencial de servidor en Preview. El responsable introduce los valores: nunca en chat ni Git. Variables que consume el código: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. La clave de servidor nunca lleva prefijo VITE.
- Sesión administrativa de prueba con rol verificado por `profiles`, sin elevar usuarios productivos ni desactivar RLS.
- Canal autorizado para comprobar SQL/RPC, grants, leases/checkpoints y métricas sin PII. No se demuestra que los recursos existentes de laboratorio tengan ese esquema o esas credenciales.
- Reconciliar schedulers actuales antes de activar uno de 30 minutos. Hay cron Vercel de sourcing cada 6 h; PLAN Cloud cada 6 h; infraestructura cada 6 h; informe diario; y referencias históricas a heartbeat local de 30 min, no verificado en esta sesión. Cron Vercel clásico opera solo en producción; no activar producción para probar Preview.
- Faltan ciclo durable completo, medición económica, heartbeats, asignación con ejecutores reales, UI integral de misiones/GitHub/infraestructura/autonomía/auditoría/dirección y ejecución autónoma de desarrollo revisable.

## 11. Costos y recursos
Sin nuevos proveedores, servicios contratados, modelos pagos ni recursos de base de datos. Dependencias existentes y pruebas locales. Preview usa la infraestructura existente; no se midió su costo marginal y no se garantiza costo cero. No se cambian presupuestos, facturación ni frecuencias.

## 12. Siguiente desarrollo prioritario
Verificar primero el ledger aislado y sus permisos/migraciones con un canal SQL autorizado. Después, revisión de #272/#273 y una prueba acotada de lease → observación → checkpoint → liberación/recuperación, con cuotas, evidencias independientes y sin envíos. Solo tras reconciliar schedulers, activar un único disparador cloud de 30 minutos bajo autorización específica.

Rollback del incremento: revertir su commit de aplicación; no hay efectos SQL ni schedulers que deshacer. No fusionar ni desplegar a producción automáticamente.
