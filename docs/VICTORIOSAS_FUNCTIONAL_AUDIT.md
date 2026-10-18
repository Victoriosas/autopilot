# Victoriosas — auditoría funcional

Fecha: 2026-10-17, America/Montevideo. Trabajo en `C:/autopilot-worktrees/diseno`, rama `codex/victoriosas-functional-audit-20261017`, base `origin/main` 1d647a2. Estado inicial del worktree limpio. Cambios locales de C:/autopilot preservados. Sin SQL remoto de escritura, mensajes, compras ni cambios de credenciales o DNS.

## Resultado y límites

La entrada pública pasa a una experiencia de estética orientada a consultas, sin montar AppProvider comercial. Comercio, cuentas de clientes, proveedores y checkout se conservan internamente; no se eliminan tablas ni historial. `/admin` carga la aplicación interna solo con rol admin; `/beauty-professional` mantiene autorización profesional separada. El backend sigue siendo la autoridad de permisos.

**Identidad sin resolver:** las nuevas instrucciones dicen Victoria, mientras los textos y contacto históricos dicen Sofía Fernández. No se publican una biografía, foto atribuida, certificaciones ni tratamientos específicos hasta confirmación del propietario. Se conserva el número WhatsApp existente con un mensaje neutral. Esto impide declarar terminado el objetivo de presentación de Victoria. No hay tarifas, servicios aprobados, disponibilidad o ventas inventadas.

## Matriz funcional

| Funcionalidad | Estado anterior | Dependencia de Supabase | Problema encontrado | Acción realizada | Prueba ejecutada | Estado final |
|---|---|---|---|---|---|---|
| Inicio y navegación | OBSOLETA para nuevo enfoque | Ninguna necesaria | Productos, carrito, cuentas y herramientas comerciales en portada | Entrada React pública independiente, navegación por secciones | Playwright 1440/768/390/320, anchors y rutas | FUNCIONAL local; pendiente preview/producción |
| Servicios | INCOMPLETA | beauty_services, control de publicación | No hay fichas publicadas aprobadas | Consulta orientativa sin fichas/tarifas, sin promesas | Navegador, GET remoto catalog | Contacto disponible; catálogo publicado bloqueado |
| Presentación personal | INCOMPLETA | No | Discrepancia Victoria/Sofía | Texto neutral, sin atribuir imagen o credenciales | Revisión de contenido | Pendiente confirmación humana |
| WhatsApp | FUNCIONAL como enlace | Ninguna | Mensaje atribuía una identidad no conciliada | Mismo número histórico, mensaje neutral | href y codificación comprobados; ningún envío | Enlace verificado; recepción humana no probada |
| Formulario público | INCOMPLETA | beauty_requests, service_role, privacidad/retención | Flag no acredita readiness integral | No se monta formulario público; ruta antigua lleva a nueva experiencia | Navegador sin forms, tests de gates y retry | BLOQUEADO; alternativa WhatsApp |
| HTML de servicios antiguo | OBSOLETA | API Beauty | Tarifas de propuesta y estilo separado | Sustituido por traslado a /servicios | Ruta real y test sin formulario/tarifas | Reversible vía Git |
| JS Beauty preservado | INCOMPLETA/INTERNA | Catálogo y configuración | catalogEnabled=false restauraba precios legacy | Sin fallback; no leer FormData ni habilitar controles hasta gates activos | Pruebas frontend con datos sintéticos, fallo/config false/catálogo vacío | Cerrado ante fallos; no es prueba remota |
| Registro Beauty backend | INCOMPLETA | Solicitudes y trigger | Solo limitación por contacto, no global; sin retención operativa comprobada | Preservado cerrado por configuración productiva | GET /config remoto false; rutas admin negativas | No habilitar datos reales |
| Lista de espera comercial | OBSOLETA en público | storefront_waitlist, service_role | API seguía aceptando aunque UI oculta | WAITLIST_ENABLED opt-in, default 503 antes de leer body | Test con getter de body y spy proveedor | Cerrada por defecto en revisión |
| Administración | INTERNA | Auth, profiles admin y RLS | No corresponde navegación pública | Ruta /admin explícita sin enlace público; guardas conservadas | Pantalla anónima y HTTP 401 | Acceso negativo verificado; login admin real no ejercitado |
| Evaluación profesional | INTERNA | practitioners/evaluations y RLS | Datos sensibles, autorización distinta de admin | Preservada separada, sin enlace público | Pantalla privada, HTTP 503 con módulo deshabilitado, inspección RLS | Cerrada; sesión profesional real no probada |
| Productos/dropshipping/carrito/checkout | OBSOLETA en público / INTERNA | Comercio histórico | Enfoque incorrecto | Se conserva código fuera de entrada pública | Navegador sin enlaces comerciales; health checkout=false | Oculto reversible; no se activan cobros |
| Sourcing/CJ/mercados/automatización | INTERNA | Tokens, proveedores, RPC | Sin evidencia actual de sourcing operativo | Preservar gates y scheduler existentes | Inspección mount/security/legacySafety | No declarada operativa, no se ejecuta sourcing |
| Pagos/reconciliación/webhooks | INTERNA | Proveedor y RPC | API no desaparece al ocultar UI | Preservada conciliación histórica y bloqueo checkout | Health remoto checkoutRequested=false | No se hicieron pagos ni sandbox |
| SEO | OBSOLETA | No | OnlineStore y FAQ comerciales | Metadata de estética, Organization sin dirección/ofertas; robots privado | Test JSON-LD y HTML, títulos navegador | Verificado local |
| Dependencias | INCOMPLETA en seguridad | No | 5 avisos prod, incl. proxy-addr crítico | audit fix compatible del lockfile, sin upgrades mayores ni eliminar infraestructura | npm audit y repetición verify | 0 avisos prod tras actualización; CI por verificar |
| Métricas, campañas y retención comercial | INCOMPLETA/INTERNA | Analítica y consentimiento | Sin cifras verificadas | Sin tracking publicitario ni envíos | Inspección de nueva entrada sin fetch/píxeles | No hay datos reales suficientes todavía |

## Supabase remoto: evidencia actual

Proyecto conectado inspeccionado: `jfjzpwlrhzqbcrvqxhzf`, ACTIVE_HEALTHY. El bundle público de producción `index-WYDOaZRl.js` contiene exactamente ese host Supabase. Health productivo indica SHA `1d647a2ad3cac9b091b4aa3a6decca49313d1a2e`, checkoutRequested=false y checkoutEnabled=false. GET /api/beauty/config devuelve requestsEnabled=false; /catalog devuelve catalogEnabled=false, services=[].

Consulta de metadatos remotos, sin leer filas personales: las 33 tablas públicas tienen RLS, incluidas las cinco tablas Beauty. `beauty_services` tiene cuatro borradores, disponibles=false y price_approved=false; private.beauty_publication_enabled() devuelve false. Solicitudes y evaluaciones no tienen grants anon; servicios tienen SELECT anon sujeto a publicación; profesionales se restringen por usuario. Políticas de evaluaciones combinan profesional asignado, vigencia y membresía activa. La función de purge verifica UID y rol admin antes de borrar; no se ejecutó.

| Nombre | Versión local | Versión alojada |
|---|---|---|
| beauty_requests | 20261017220000 | 20261017223014 |
| beauty_retention | 20261017221000 | 20261017223016 |
| beauty_catalog_evaluations | 20261017230000 | 20261017223019 |

Las tres migraciones **ya existen alojadas**, a diferencia de checkpoints antiguos. Los nombres coinciden, las versiones no. La comparación de los tres SQL normalizados (sin comentarios --, espacios colapsados) coincide con los statements alojados: requests `98bc663524a244e7128cfc78e6252ef7`, retention `40c40d88d491d2703de168d73864240c`, catalog/evaluations `56d9d9fc8f32f9df3139bedc96b80009`. Esto demuestra equivalencia de esos textos normalizados, no que el DDL efectivo no haya recibido cambios posteriores ni reconciliación de todo el historial comercial. No ejecutar db push. Próximo paso DB: exportación de DDL/funciones/grants y comparación normalizada offline; respaldo/restauración verificables y aprobación específica antes de cambios remotos.

No hay esquema cron en la base consultada; esto no descarta un scheduler externo, cuya operación no fue demostrada. Expiración por RLS no demuestra eliminación física. Sigue pendiente responsable de retención y privacidad aprobado. Formulario no se habilita por la mera existencia de tablas.

## Integraciones y configuración

Se inspeccionaron referencias y contratos de variables, sin volcar .env ni secretos: SUPABASE_URL/VITE_SUPABASE_URL, claves públicas/servidor, BEAUTY_REQUESTS_ENABLED, BEAUTY_CATALOG_ENABLED, BEAUTY_PUBLICATION_ENABLED, BEAUTY_PROFESSIONAL_ENABLED, CHECKOUT_ENABLED, CJ_API_KEY, tokens del control plane, CRON_SECRET, Mercado Pago, PayPal y OAuth MercadoLibre. No se certifica validez de todas las credenciales.

Sourcing/control plane/CJ están sujetos a guardas; legacySafety conserva 410/423 en acciones históricas riesgosas. OAuth callback y webhooks/reconcile de pagos requieren exposición por su protocolo: conservar, revisar abuso por separado y no confundir con navegación pública. La lista de espera sí se cierra por no corresponder al nuevo enfoque.

No se eliminaron dependencias presuntamente sin uso: @google/genai, motion y autoprefixer requieren revisar scripts/configuración completa antes de supresión. canvas-confetti se usa en checkout histórico y se conserva.

## Verificación y recuperación

- `npm run verify`: TypeScript, pruebas Node, build servidor y build Vercel. Primera pasada 182/182; validación final tras npm ci, lockfile y gate waitlist: **183/183**, tipos y ambos builds exit 0. CI y SHA final se registran al publicarse.
- Windows: la prueba offline Get-FileHash necesita PSModulePath de WindowsPowerShell al invocar Windows PowerShell desde pwsh. Se añadió al entorno del comando de prueba, sin modificar política ni scripts del usuario.
- Playwright real local: 1440, 768, 390 y 320 px; sin overflow, un H1, cero forms, cero enlaces a admin/checkout/proveedores; FAQ y teclado. Rutas /servicios, /contacto, /victoria, /carrito, /checkout y HTML antiguo ya no montan comercio. Script reproducible `scripts/verify-victoriosas-public.cjs` mediante playwright-cli run-code --filename, tomando el origen de la pestaña actual.
- Capturas antes/después en output/playwright. Inspección visual desktop y móvil realizada. No certifica WCAG completa ni métricas de campo LCP/INP/CLS.
- Acceso HTTP negativo real producción: admin Beauty 401; profesional 503 deshabilitado. No se probó sesión admin/profesional autorizada en producción, ni persistencia con datos reales.
- WhatsApp: solo destino inspeccionado. No se envía ni se crea una reserva real.
- Sin borrados de tablas/registros, sin nueva automatización, sin cambios a cobros/credenciales/DNS. Reversión: revertir commits de esta rama y redesplegar la revisión anterior; nunca usar rollback SQL destructivo para revertir interfaz.

## Siguiente prompt seguro

“Sobre el SHA revisado de esta rama, comprobar CI y preview Vercel. Repetir el recorrido público en la preview sin registrar solicitudes ni enviar WhatsApp. Comparar migraciones Beauty por DDL normalizado sin escrituras remotas y documentar diferencias. Mantener recepción y publicación cerradas. Obtener confirmación de identidad Victoria/Sofía, contacto, servicios y privacidad/retención antes de habilitar catálogo o formularios. No tocar pagos ni datos reales.”

Continuidad ejecutada en este ciclo: cierre de API waitlist residual y parcheo compatible de dependencias. Sin duplicar scheduler existente.

Prueba adicional: intento PostgREST directo desde Node sin datos (limit=0) terminó en ConnectTimeout antes de obtener respuesta; no se usa como evidencia de RLS ejecutada. La comprobación alojada de esta sesión es por metadatos SQL y HTTP negativo de la aplicación.

## Cierre del ciclo y revisión independiente

- PR #79 draft: https://github.com/Victoriosas/autopilot/pull/79. Código inicial badfe9c; corrección de rutas retiradas 51caa6f. Preview READY de 51caa6f: https://autopilot-jzo7qby4h-autopilot12.vercel.app (protegida). Playwright recorrió esa preview sin errores de aserción en los cuatro anchos y accesos negativos. No se promovió producción.
- Core CI 39089079271 y 39089082441 success en 51caa6f. Beauty Supabase aislado 39088998832 success en badfe9c, con Auth/PostgREST/RLS reales desechables; no equivale a persistencia alojada. Cambios posteriores de acceso privado requieren nueva CI y preview.
- La revisión independiente detectó doble H1 en rutas retiradas: corregido con vista exclusiva de página retirada. Admin y professional no presentan storefront transitorio según inspección.
- La comprobación de red de preview detectó intento heredado automático de signup anónimo (422 rechazado) al montar AppProvider privado y llamadas a conectores sin sesión. Se corrigió con modo internalOnly: sin alta anónima al entrar/salir, sin sincronización comercial antes de rol admin y limpieza de rol al perder sesión. Se preserva el modo comercial histórico para recuperación.
- Repetición local tras esa corrección: cuatro tamaños, diez recorridos/rutas y cero intentos POST/PUT/PATCH/DELETE durante navegación; la prueba bloquea preventivamente toda escritura y falla si se intenta alguna. El único POST deliberado posterior lleva cuerpo vacío a waitlist y exige 503. No se envían datos personales ni mensajes.
- Pendientes de negocio: identidad profesional y contacto aprobados, servicios/tarifas, responsable de privacidad/retención. Pendientes de validación: login admin/profesional real autorizado y persistencia end-to-end cuando se habilite; no se sustituyen con mocks.
