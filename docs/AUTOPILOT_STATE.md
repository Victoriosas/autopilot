# Victoriosa — continuidad

Actualizado: 2026-10-10, America/Montevideo. Leer este archivo y verificar Git antes de continuar. No asumir ejecución fuera de la sesión.

## Referencia y restricciones
- Continuado desde 42be14e, rama codex/autopilot-v4-durable-orchestrator. Último código: 494801a. Solicitud posterior: subir a Git/Vercel. Push realizado y preview verificado; sin merge a main, despliegue de producción, migraciones externas ni pagos reales.
- Preservados .audit/, .playwright-cli/ y scripts raíz ajenos sin seguimiento.
- ECC tdd-workflow y database-migrations aplicados. Mantener pruebas antes de implementación, migraciones aditivas y pagos bloqueados hasta evidencia real. Sin compras a proveedores ni cambios sensibles.

## Cambios
- Migración supabase/migrations/20261010010000_atomic_checkout.sql: reserva transaccional con bloqueo por clave/productos; precios, moneda y stock del servidor; una orden por clave; liberación única; confirmación ligada a referencia/importe del proveedor. RLS y RPC restringida a service_role.
- Mercado Pago usa RPC y la misma clave del proveedor derivada de orderId. Reintentos y webhooks no duplican órdenes, reserva ni cola; duplicados no revierten estados enviados. No se afirma cobro real único validado en el proveedor.
- Expiración sin intento de proveedor libera stock; resultado remoto desconocido conserva reserva. Pago tardío confirmado sigue siendo válido mientras el stock está retenido. Rotación persistente evita que veinte pagos inciertos bloqueen reservas posteriores.
- Fulfillment tiene cola única, lease/generación/fencing y recuperación. Siguiente prioridad ejecutada: preparación de una tarea manual durable por pedido pagado, recuperable tras caída. No compra ni envío externo. POST /api/commerce/maintenance/run y GET /api/commerce/maintenance/tasks exigen administrador Supabase; sin scheduler conectado.
- Navegador conserva clave opaca por intención, sin PII persistida; retorno terminal retira su clave y permite otra compra. Pendiente/incierto conserva clave.
- Health/config distinguen checkout solicitado y disponible. Credenciales solas no habilitan: requieren flag atómico, RPC y evidencia vigente de proveedor/entorno/moneda/fulfillment. PayPal y transferencias nuevas deshabilitados.

## Evidencia ejecutada
- npm run test:commerce:db: 8/8, cero omitidas. PostgreSQL 18 real, cluster temporal nuevo en loopback, base victoriosa_checkout_test y esquema sintético. Conexiones separadas para concurrencia. Cluster detenido al finalizar; evidencia sintética retenida en C:\Users\micahael\AppData\Local\Temp\victoriosa-checkout-test-732x1S.
- PostgreSQL verificó última unidad reservada una vez, reintentos concurrentes una orden, rechazo/vencimiento seguro libera una vez, referencia/importes/moneda, webhook duplicado sin regresión, una cola, takeover y fencing, tarea manual única tras caída, permisos, readiness sin attestation falsa y rotación de vencimientos.
- RED/GREEN: 31451c2 → 63c83b1 stock; 20e78ba/1128071/51590a6 → ffa69c3 disponibilidad/router; b967303 → 6647a7c fencing; 8f4be5d → 9fe1c54 vencimiento/duplicados; fae03cd → 80b2c9e mantenimiento/manual; cda105f/3f81c14 → 80b2c9e claves/terminalidad; 28fe4fb → 494801a rotación. RED incluyó API ausente y errores reales/aserciones. PostgreSQL también detectó referencia ambigua, corregida antes del GREEN.
- npm test: 95/95, cero fallos/omitidas. npm run lint, npm run build, npm run build:vercel: exit 0. Advertencia existente: bundle principal 590.94 kB.
- Cobertura Node para atomicCheckout/availability/mercadoPago/commerceMaintenance/checkoutKey: líneas 92.41%, ramas 93.33%, funciones 80.65%. AtomicCheckout y checkoutKey líneas/funciones 100%. Cobertura de módulos, no global ni SQL.
- Revisión independiente: atendidos regresión de estados, vencimiento incierto y starvation. Sin browser E2E, sandbox Mercado Pago, PostgREST integrado ni validación del esquema Supabase completo. Mocks del proveedor no equivalen a validación bancaria.

## Producción observada, sin cambios
- GET https://victoriosas.online/api/health: HTTP 200, commit c07479554a329f28aa53fd5d3d919315f433de80, checkoutEnabled true; configs públicas también anuncian Mercado Pago disponible.
- Causa comprobada en código previo: health usa CHECKOUT_ENABLED bruto y config considera credenciales suficientes. Corrección únicamente local; producción conserva ese comportamiento hasta despliegue autorizado.
- Contrato consultado: https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/create-order/post y https://www.mercadopago.com.uy/developers/es/docs/checkout-api-orders/resources/migrate-payments-to-orders . Compatibilidad cuenta/país/moneda/redirect pendiente de sandbox autorizado.

## Bloqueos y siguiente acción
1. Preparar recuperación administrativa segura de provider_started sin ID después de vencimiento: conservar stock y usar la misma clave; verificar proveedor antes de liberar o intentar pago nuevo. Hoy maintenance solo reporta incertidumbre.
2. Resolver clave de checkout terminal/vencida cuando comprador no retorna: consultar estado al reintentar y retirar clave solo con terminalidad comprobada; nunca rotar por timeout desconocido.
3. Antes de despliegue, verificar esquema Supabase completo y pedidos legacy sin sesión atómica; no hay backfill automático. Captura histórica legacy fuera de garantías de este flujo.
4. Validar Mercado Pago en sandbox autorizado, reintentos/red incierta y operación de entrega manual. Solo después registrar attestation del entorno correspondiente; nunca habilitar live con mocks/PG sintético.
5. Preparar scheduler autenticado y operación de tareas manuales cuando se autorice infraestructura. Cola done significa preparación manual durable, no envío ni compra externa.

No hay datos reales suficientes de ventas/conversión/ingresos. Continuar recuperación segura y compatibilidad legacy sin desplegar ni ejecutar pagos reales.

## Git/Vercel — solicitud posterior
- Rama subida a origin; PR #65 actualizado: https://github.com/Victoriosas/autopilot/pull/65 .
- Preview Vercel READY del commit 523fba46ad4cb0a9a9940c9cc03d41b12cd76a6e: https://autopilot-7xif12ofi-autopilot12.vercel.app .
- GET autenticado por conector /api/health y /api/payments/mercadopago/config: HTTP 200, checkoutEnabled false y configured false, CHECKOUT_DISABLED. Protección Vercel vigente.
- GitHub validate pasó en ambos runs. Preview Supabase omitido por integración; no equivale a validación de migraciones.
- Producción conserva versión previa. No promover mientras falten compatibilidad legacy/esquema y validación del proveedor.


## Revisión posterior al merge — 2026-10-10

Base verificada: main 722f2ce (PR #65 integrado). Trabajo aislado en codex/post-merge-review-20261010; copia previa con cambios preservada. ECC no instalado en este entorno: cinco agentes generalistas de Codex cubrieron pagos, seguridad/CI, storefront/E2E, SQL y revisión independiente.

- Pagos terminales con dinero cobrado no liberan stock; importes coercibles se rechazan antes de RPC.
- Claves solo se retiran tras reserva released verificada, error tipado y HTTP409; no hay nuevo pago automático. Resultados inciertos conservan clave/stock.
- Barreras legacy normalizan mayúsculas, barra final y HEAD; guard administrativo delimita V4 por segmento. Suite security incluida en npm test.
- Comparables UYU no se mezclan con otra moneda; código de error explícito.
- Diálogos tienen foco/Escape/nombres y scroll móvil; cantidad adicional descuenta carrito agregado.
- CI incorpora comercio PostgreSQL en base dedicada después de sourcing; roles fixture idempotentes y restricciones relevantes legacy. Añadidas pruebas rollback multítem e inputs inválidos. Runner conserva diagnóstico de arranque y no declara cluster detenido si no arrancó.

Validación local: main limpio 95/95 pruebas. Rama modificada: suite completa/TypeScript/builds y secret scan según ejecución final; E2E Chromium aislado desktop1440/mobile390 aprobado (incluye cambio de clave y ausencia de reintento automático), capturas sintéticas docs/evidence. PostgreSQL local no ejecutable (initdb no instalado y runtime no permite cambio UID); validación SQL requiere GitHub CI aislado. Sin migraciones externas, pagos reales, compras, merge ni promoción a producción.

Siguiente: verificar resultado CI PostgreSQL de esta rama y corregir cualquier fallo; comprobar esquema Supabase completo/compatibilidad de pedidos legacy y sandbox Mercado Pago antes de activar comercio. Recuperación administrativa sin provider ID, scheduler operativo y envío fraccionario requieren ciclos posteriores.
