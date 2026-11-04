# Victoriosas + Autopilot | Dirección permanente del producto
Fecha inicial: 2026-11-04. Este documento describe la visión y los criterios duraderos; **no** convierte evidencias antiguas en estado actual.

## Identidad, alcance y roles
- **Victoriosas**: marca pública de estética profesional. Sitio `https://victoriosas.online`. Atención humana responsable: Victoria. Navegación por páginas, estética profesional, comunicación en español, evaluación inicial remota. No reintroducir domicilios, precios públicos, carrito ni dropshipping.
- **Autopilot**: plataforma interna y motor de agentes, colas, conocimiento, comunicaciones, orquestación y trazabilidad; hoy comparte `Victoriosas/autopilot` y la infraestructura existente. No confundir una interfaz de laboratorio con un servicio continuo.
- **Dirección**: el propietario decide objetivos y políticas; Victoria valida hechos profesionales y mensajes sensibles; la IA prepara o automatiza únicamente acciones verificables y autorizadas. Separar roles en código y permisos.
- **Evolución**: mantener módulos sustituibles para, a futuro, derivar un motor comercial multiempresa independiente con aislamiento de datos por cliente. NO iniciar ni mezclar otro SaaS ni migrar secretos/datos de Victoriosas durante las fases actuales.

## Norte del producto
Reducir la carga operativa del responsable mediante una oficina digital auditable: recepción y clasificación, bandeja única, respuestas basadas en fichas aprobadas, correo, WhatsApp, seguimiento, agenda orientativa, consultas, reportes, campañas y coordinación de redes. Primero atender bien a una clienta de extremo a extremo; después expandir canales y autonomía.

**Flujo primordial**: visita → /consultanos o WhatsApp → consentimiento y recepción → expediente privado → clasificación → recuperación de datos aprobados → borrador → guardián clínico/comercial → revisión humana cuando corresponda → respuesta deduplicada → auditoría → seguimiento opt-in. Las reservas solo se coordinan personalmente y una indicación estética exige evaluación apropiada. No diagnosticar ni prometer resultados.

## Fases obligatorias (sin saltos)
| Fase | Meta | Puerta de salida verificable |
|---|---|---|
| F0. Base de verdad | GitHub, PC, Vercel, Supabase, Resend, Cloudflare, camelRun inventariados | SHA y rama por entorno, historial de migraciones, rutas de datos, autorizaciones, costo y riesgos documentados |
| F1. Consulta confiable | Formulario y bandeja admin realmente funcionales | Navegador móvil/escritorio, desafío Cloudflare, GET/POST, consentimiento, Auth, persistencia, deduplicación y respuesta supervisada con pruebas aisladas y verificación productiva autorizada |
| F2. Conocimiento profesional | 17 tratamientos, más orientación, fichas versionadas y revisadas por Victoria | Hechos sin invenciones; RLS/permisos y retención probados; ausencia de precios/diagnósticos; aprobación y vigencia por ficha |
| F3. IA en laboratorio | Comprensión → Recuperación → Redacción → Guardián → política determinista | 40 casos congelados + 6 negativos, evidencia de costo total y proveedor; sin PII real ni correos de prueba a clientes |
| F4. Recepción supervisada | Un circuito real de casos con borradores y aprobación | Integración real con Resend, estados de entrega inciertos, consulta/cliente preservados y trazabilidad end-to-end |
| F5. Autonomía acotada | Solo respuestas administrativas seguras según niveles N0–N4 | Matriz explícita de acciones autorizadas, consentimiento, escape humano, límites de presupuesto, deduplicación, pruebas canario y apagado inmediato |
| F6. Omnicanal | WhatsApp Business, Instagram/Facebook y luego X/calendario | APIs oficiales, permisos, webhooks, contratos, preferencias/consentimiento y auditoría; no plataformas simuladas |
| F7. Operación y crecimiento | Informes, seguimiento, campañas/agenda, métricas y despliegue robusto | Observabilidad real, SLAs realistas, aprobación editorial, costo bajo control y autonomía sin depender del PC |
| F8. Motor extensible | Evaluar producto multicliente separado | Arquitectura/seguridad multi-tenant, aislamiento, facturación y comercialización en proyecto propio, solo por decisión estratégica explícita |

Fases posteriores pueden diseñarse sin activarse; cualquier petición lateral no desplaza el P0/P1 vigente. Cada cambio debe identificar la fase, su puerta y la evidencia que aporta.

## Autonomía gradual y guardas
- N0 diagnóstico, N1 borradores, N2 ejecución técnica reversible/sintética, N3 respuesta no clínica de bajo riesgo con permiso explícito y controles verificables, N4 expansión aprobada con alertas y límites. Por defecto consultas reales permanecen supervisadas.
- No enviar consejos de salud o tratamientos personalizados sin evaluación profesional; derivar dudas clínicas a Victoria. No publicar campañas/posts sin aprobación. No inventar disponibilidad de agenda, precios, direcciones, logros o promociones.
- Nunca integrar tokens en Git, issue, prompts públicos o logs; emitir solo nombres de variables, proveedores y estado. Secretos y acceso mínimo por entorno, rotación con análisis previo.
- Mantener compras, pagos, ecommerce histórico, comercio, despliegues manuales, DNS y campañas desactivados, salvo autorización específica y verificación del riesgo. La autorización general de coordinación no convierte una prueba en permiso operativo para enviar a terceros.
- Priorizar costo externo US$0 comprobado; que un modelo marque USD 0 por token no acredita runtime/almacenamiento/red gratuitos. Sin evidencia de tarifa/limite, IA remota apagada.
- Un workflow programado o un agente definido NO prueba ejecución 24/7. La independencia de la PC exige disparadores cloud y métricas de runs/errores.
- Respetar `AGENTS.md`, políticas de privacidad, RLS, aprobación humana, idempotencia/lease/fencing y no duplicar colas/schedulers.

## Fuente de verdad y gestión
1. Código y GitHub `main` + PRs, pruebas, CI y scripts: **qué está implementado**.
2. Vercel y dominio real: **qué está desplegado y accesible**.
3. Supabase, Resend y proveedores: **qué se ejecutó realmente**. No leer datos personales para una auditoría de estado.
4. `docs/AUTOPILOT_STATE.md`: continuidad técnica fechada; las entradas históricas NO tienen prioridad sobre mediciones actuales.
5. Este archivo: **qué construimos, en qué orden y qué no vamos a hacer**.

Ciclo de trabajo: inventario → elegir la prioridad más temprana bloqueada → rama/PR mínima → tests sintéticos y CI → revisión de seguridad/costo → despliegue aprobado → verificación y registro de resultados → siguiente fase. Informar **DEFINIDO, PROBADO, FUSIONADO, DESPLEGADO, EJECUTADO o BLOQUEADO** de forma independiente.

## Verificación F1 posterior · 04/11/2026
- El bloqueo global de Cloudflare fue corregido en su configuración; rutas públicas y API de consultas volvieron a HTTP 200, con navegador Chrome desktop/móvil y smoke de solo lectura satisfactorios. Ver `docs/CONSULTATION_F1_RESTORATION_20261104.md`.
- **F1 no finalizada:** el circuito de envío/persistencia/recepción/revisión de un caso controlado con sesión humana todavía no se probó en producción. Conservar supervisión y no enviar mensajes de prueba a clientas.

## Incidentes y prioridades al 04/11/2026 (revalidar antes de actuar)
- Main `aef2ab73b210985e466ed770a9fd5470608cbf28`, Vercel producción READY en ese SHA; no equivale a dominio accesible desde todas las redes.
- Supabase principal `jfjzpwlrhzqbcrvqxhzf` registra 41 migraciones y 17 tratamientos; `private.consultation_service_knowledge` existe pero tiene cero fichas. Aclarar la diferencia entre filas de catálogo y hechos revisados.
- La integración **Supabase Preview** podría estar vinculada al proyecto histórico `uunygxsjzavzmfqfijka` con tres migraciones. Ver issue #180; no reparar historial ni crear ramas pagas por reflejo.
- En formulario /consultanos, se corrigió uso de cookies en PR #176, pero el desafío inicial de Cloudflare puede persistir. Necesita prueba real del recorrido, no POST de prueba en producción a ciegas.
- Siete agentes camelRun definidos y sin herramientas conectadas al momento del inventario; laboratorio local sintético no es operación autónoma. Validar costo completo antes de inferencia.
- PC de trabajo debe inspeccionarse al reconectar: jamás `reset --hard`, `clean -fd`, `pull --rebase` ni `stash` automático antes de respaldar y revisar su trabajo.
- Auditoría contemporánea: `docs/AUDITORIA_DIRECCION_20261104.md`; procedimiento PC: `docs/SYNC_PC_GITHUB_SEGURO.md`.

## Regla de enfoque para toda IA y herramienta
Antes de empezar una tarea, responder internamente: «¿qué fase sirve, qué evidencia falta, qué riesgo crea y cómo vuelvo atrás?». Si la idea no destraba la fase activa, registrarla como backlog y volver a F1, F2, F3 y F4 en ese orden. No crear nuevos nombres, servidores, repositorios o agentes para reemplazar capacidades existentes sin demostrar la necesidad.
