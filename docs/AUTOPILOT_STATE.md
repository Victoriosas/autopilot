# Victoriosa — continuidad

Actualizado 2026-10-10, America/Montevideo. Verificar Git antes de actuar; no asumir ejecución fuera de la automatización configurada.

## Objetivo y límites
Experiencia comercial comparable a Tiendamia, especializada en skincare cosmético, autocuidado, herramientas faciales y spa en casa para Uruguay. Diferencia buscada: descubrimiento, evaluación, integración y mantenimiento autónomos, no catálogo estático. No se afirma superar a Tiendamia ni conocer su arquitectura.

Flujo objetivo: proveedor autorizado → identidad/imágenes/variantes/stock/envío/costo/riesgo comprobados → margen y precio → ficha española sin claims médicos → deduplicación y barreras de publicación → sincronización → reserva/pago/fulfillment recuperable. Extender mercados solo tras verificar logística/moneda/costos.

Sin gastos, compras a proveedores, cobros reales, cambios de credenciales/DNS/pagos, migraciones externas o promoción a producción. Cambios mínimos, reversibles y probados. Preservar .audit/, .playwright-cli/ y test-*.ts raíz ajenos. Actualizar solo este archivo de continuidad; no reportes repetitivos ni métricas inventadas.

## Estado real
- Producción victoriosas.online comprobada este ciclo: 722f2ce902a26b768b752be7aef4737b30262025; health/config HTTP200, checkoutEnabled=false/configured=false, checkoutRequested=true, ATOMIC_CHECKOUT_NOT_ENABLED. No promoción realizada.
- Rama codex/post-merge-review-20261010, PR #66 borrador: https://github.com/Victoriosas/autopilot/pull/66. Lote belleza e27f742; merge243c93f incorpora el avance remoto envío c3e2fbe sin sobrescribirlo. Código combinado verificado ea1cf3f7b6bcb8ab0d537c35b1d2902f5d02f662; actualización posterior solo documentación.
- Preview ea1cf3f READY dpl_7udN27QTpPDh39Si9Zjb2rBEu8r5: https://autopilot-r3xyu506e-autopilot12.vercel.app. GET protegidos health/config HTTP200; commit exacto, checkoutEnabled=false/configured=false, CHECKOUT_DISABLED.
- Envío remoto 8b70694 tenía CI validate/postgres success, Node110/110, comercio PG11/11 y preview HTTP200 con checkout deshabilitado. Integración local enfocada: shipping/atomicRouter4/4.

## ECC y autonomía
- ECC2.2.3 disponible localmente: 71 perfiles y302 skills. Perfiles son guías adaptables, no herramientas ni agentes OpenCode automáticamente ejecutables.
- Aplicados tdd-workflow, database-migrations, automation-audit-ops, frontend-design-direction y e2e-testing; revisiones independientes de backend y UI mediante agentes Codex.
- Automatización existente victoriosa-autopilot-6h ACTIVE cada seis horas, sin duplicar scheduler. Lee este archivo, evita solapamiento y avisos sin cambio útil; mantiene restricciones. Es desarrollo asistido por runtime local Codex; no demuestra ejecuciones futuras ni automatiza compras/cobros.
- Cron comercial de sourcing existente conserva enabled/shadow/publicación y autenticación propias. No se habilitó mediante este ciclo. Mantenimiento admite administrador y una entrada cron preparada, sin scheduler activo.

## Implementación
- Checkout conserva reserva atómica, clave idempotente, verificación servidor de referencia/importe/moneda/fondos, liberación segura, cola única y recuperación con fencing. Pagos inciertos conservan reserva/clave; recuperación busca orden existente por GET y requiere coincidencia única; nunca crea/cobra para recuperarla.
- RPC commerce_recover_provider_order (migración aditiva20261010020000), locks sesión→pedido, ID remoto único. Mantenimiento rota una reserva y un trabajo por invocación.
- GET /api/commerce/maintenance/cron: secreto dedicado COMMERCE_MAINTENANCE_CRON_SECRET, comparación segura y opt-in exacto COMMERCE_MAINTENANCE_CRON_ENABLED=true; defaults deshabilitados en .env.example. HEAD405 sin efectos; auth antes de DB/proveedor; errores genéricos503. Reutiliza worker bounded/locks/fencing; recupera pagos existentes y prepara fulfillment manual, sin cobros/compras/cancelación. No variables externas ni vercel.json/scheduler modificados.
- Shipping admite importes no negativos con hasta dos decimales dentro de DECIMAL(10,2). Config inválida deshabilita disponibilidad y se rechaza antes de reserva/proveedor. No cambio SQL en ese lote.
- beautyDiscoveryPlan rota ocho búsquedas de belleza cada seis horas, una por presupuesto existente; override explícito respetado. Cron captura un slot para plan y clave durable, preservando límites de IA y barreras.
- Brumas/esencias/parches y dispositivos faciales se envían a revisión existente. Claims médicos y garantías permanentes probadas en español/inglés se rechazan, normalizando acentos y whitespace. Filtro conservador, no certificación regulatoria ni vocabulario exhaustivo.
- Catálogo: búsqueda por palabras/acento/SKU, rutina, presupuesto, unidades registradas y precio; excluye borradores/precios inválidos. Limpiar filtros reinicia también categoría y consulta.
- Tarjetas cálidas y legibles, acciones de teclado/favoritos/bolsa con nombres accesibles; sin estrellas, reviews, badges, descuentos o imagen de producto inventados. Disponibilidad sigue por confirmar.

## Evidencia
- Mantenimiento cron: RED6ad2777 (endpoint ausente404) → GREEN2/2 HTTP y maintenance5/5; HEAD RED200→GREEN405. TypeScript y revisión independiente aprobados. CI del nuevo código pendiente al escribir; no atribuirle todavía PG previo.
- Comercio previo: PostgreSQL18 real aislado11/11, sin omitidas, validado además en CI del lote envío. Cubre última unidad concurrente, rollback, retries, liberación única, pagos duplicados/tardíos, fencing y recuperación. No repetir afirmación de PG para un commit sin comprobar CI.
- TDD belleza: RED16c2d0a módulo ausente; RED de clasificación y claims ejecutados antes de corrección; bb14b61 conserva regresiones. GREEN belleza4/4 incluye cron HTTP sintético con auth y retries; catálogo5/5. Multilínea RED→GREEN también ejecutado.
- Lote e27f742: npm run verify completo aprobado (TypeScript, suite Node, builds servidor/Vercel), secret scan y diff check. CI combinado ea1cf3f: runs38095281730 y38095277830 success; validate/postgres/Vercel pass, Supabase Preview skipped. Log38095281730: Node119/119, PostgreSQL sourcing14/14+auth1/1 y comercio11/11, cero fallos/omitidas. Builds y secret scan correctos. No afirmar validación Supabase por el check omitido.
- Browser Playwright/Edge aprobado: desktop1440×1000 y móvil390×844; rutina, inventario, búsqueda sin acentos, limpiar y orden por precio; cero errores JS/desbordamiento horizontal. Componentes reales con catálogo/AppContext sintéticos; no acredita carrito integral, Supabase ni pagos. Capturas locales .audit/catalog-discovery-20261010/catalog-1440.png y catalog-390.png, fuera del commit.

## Bloqueos y siguiente acción
- Dominio de instrucciones victoriosa.click comprobado vía HTTP público: home y health402, x-vercel-error DEPLOYMENT_DISABLED. No asociado al proyecto actual según get_project; equipo accesible solo muestra autopilot con victoriosas.online y alias Vercel. Connector no encuentra .click. Causa exacta/cuenta propietaria no verificada; no asumir impago ni resolver cambiando DNS. Docs Vercel: https://vercel.com/docs/errors/deployment_disabled. Resolver identidad/estado de hosting antes de cualquier operación autorizada sobre ese dominio.
- Supabase metadatos previos: jfjzpwlrhzqbcrvqxhzf tiene orders/products compatibles con fixture; uunygxsjzavzmfqfijka no muestra orders; commerce_checkout_sessions no apareció. Falta mapear entorno/despliegue y validar migraciones/RLS/PostgREST/triggers en Supabase aislado compatible. No afirmar integración terminada.
- Sandbox Mercado Pago sin ejecutar: no credenciales de usuario de prueba en runtime. No usar credenciales reales ni habilitar checkout como sustituto.
- Sin datos reales suficientes de ventas/conversión/ingresos; no hay evidencia que justifique presentar la tienda lista para cobrar.
- Siguiente: preparar Supabase aislado compatible y scheduler operativo de mantenimiento bajo configuración autorizada; verificar sourcing shadow read-only y fichas/costos/envío reales cuando infraestructura permita. Diagnosticar dominio .click sin modificar DNS/facturación. Browser y CI/preview de este lote terminados; no repetirlos salvo código nuevo/fallo. Conservar disponibilidad false hasta evidencia de pago/entrega recuperable.
