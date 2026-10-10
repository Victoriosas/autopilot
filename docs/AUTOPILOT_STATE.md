# Victoriosa — continuidad

Actualizado 2026-10-10, America/Montevideo. Leer primero y verificar Git; no asumir ejecución fuera de la automatización configurada.

## Objetivo de producto confirmado por el usuario
Victoriosa debe ofrecer una experiencia comercial comparable o superior a Tiendamia, especializada inicialmente en skincare cosmético, autocuidado, herramientas faciales y spa en casa. La diferencia buscada es un motor autónomo de integración y mantenimiento de productos, no solo un importador manual ni un catálogo estático. Tiendamia es referencia de producto; no se ha auditado exhaustivamente ni se afirma conocer su implementación interna.

Motor objetivo: descubrir productos mediante proveedores y canales autorizados → comprobar identidad, imágenes, variantes, stock, envío a Uruguay, costo total y riesgo → calcular margen/precio → generar ficha en español sin claims médicos → deduplicar y preparar incorporación bajo las barreras de publicación existentes → sincronizar precio/disponibilidad → vincular compra, reserva, pago y fulfillment recuperable. Extender mercados únicamente después de verificar moneda, logística y costos de cada destino.

La autonomía debe reducir intervención humana en selección, análisis, contenido y mantenimiento. No revoca restricciones sobre compras a proveedores, cobros reales, gastos, datos sensibles o promoción a producción. No publicar automáticamente productos sin evidencia comercial y de seguridad suficiente. Implementar usando las integraciones comprobables existentes antes de ampliar proveedores.

Medir la mejora con costo final transparente, coherencia de stock, fichas completas, tiempos reales de entrega, fallos recuperables e intervención manual necesaria; no afirmar que supera a Tiendamia sin comparación y resultados verificables. Después de resolver los bloqueos del flujo de pago, priorizar este motor especializado sobre un catálogo generalista.

## Estado real y límites
- PR #65 integrado en main 722f2ce. Producción Vercel comprobada mediante GET /api/health: HTTP200, commit 722f2ce902a26b768b752be7aef4737b30262025, checkoutEnabled=false, checkoutRequested=true, ATOMIC_CHECKOUT_NOT_ENABLED.
- Rama de trabajo codex/post-merge-review-20261010, PR #66 borrador. Base publicada previa b32fb03, CI validate/postgres y preview READY comprobados. Último código de este ciclo ab8a903; publicación/checks exactos pendientes al escribir.
- No merge de #66, promoción a producción, migraciones externas, pagos reales ni compras. Preservados .audit/, .playwright-cli/ y scripts raíz ajenos.

## ECC y automatización
- ECC 2.2.3 instalado localmente: 71 perfiles de agentes y 302 SKILL.md. Son perfiles adaptables, no agentes OpenCode ni herramientas automáticamente ejecutables. Pertinentes: tdd-guide, database-reviewer, security-reviewer, e2e-runner.
- Aplicados tdd-workflow, database-migrations y automation-audit-ops; revisión independiente con perfil database-reviewer.
- Automatización existente victoriosa-autopilot-6h actualizada mediante herramienta Codex, ACTIVE cada seis horas, sin duplicar ni instalar otro scheduler. Continúa desarrollo desde este archivo, evita solapamientos y reportes vacíos; conserva restricciones de producción/pagos. No automatiza compras ni cobros. Requiere disponibilidad del runtime local de Codex; configuración no demuestra una ejecución futura terminada.

## Cambios del ciclo
- RPC aditiva commerce_recover_provider_order en 20261010020000_payment_reference_recovery.sql. Administrador puede vincular ID existente después de consultar al proveedor y verificar ID/referencia/importe/moneda/fondos. Bloqueo sesión→pedido, índice único de ID remoto, sin sobreescritura ni liberación de stock. Replay después de pago no duplica cola.
- POST /api/commerce/maintenance/recover exige administrador; solo GET al proveedor. Tipos/IDs inválidos se rechazan antes de red. Pagos parciales fallidos no liberan reserva.
- Recuperación sin ID humano: maintenance consulta createdAt mediante RPC restringida; gateway.find busca órdenes por external_reference y fechas. Exige una coincidencia completa/única; después lookup valida la verdad y la RPC contrasta el pedido local. Vacío, ambiguo, parcial o fallo conserva stock/clave. Nunca POST de creación, cancelación o cobro.
- commerce_maintenance_expired selecciona y rota una reserva por invocación; fulfillment procesa una tarea. Operaciones acotadas, sin promesa de tiempo máximo absoluto ante lentitud de DB/proveedor.
- Se conservan mejoras del PR #66: stock financiero incierto, retiro de claves solo tras released verificado, barreras legacy, accesibilidad de diálogos y PostgreSQL comercio en CI.

## Evidencia
- RED 6d24c58 (API/RPC ausentes) → GREEN 0916f36 recuperación; RED 8a3acf9 (IDs malformados llegaban a red) → GREEN d011796; RED a2bc325 (sin discovery) → GREEN b35d280; RED b1e8e4b (RPC batch ausente) → GREEN ab8a903.
- npm run test:commerce:db: 11/11, cero omitidas, PostgreSQL18 real aislado, base victoriosa_checkout_test. Último cluster detenido; evidencia sintética C:\Users\micahael\AppData\Local\Temp\victoriosa-checkout-test-Tz8hkB.
- Cubiertos concurrencia última unidad, rollback multítem, cantidades/variantes, reintentos, liberación única, pagos tardíos/duplicados, fencing, recuperación concurrente, IDs incompatibles, pago compartido entre pedidos rechazado, permisos y rotación de batch.
- Suite local 108/108 antes del último ajuste de batch; pruebas maintenance 5/5 y PostgreSQL11/11 después. TypeScript, git diff --check y secret scan correctos. Builds locales pasaron antes de discovery; reutilizar CI del commit exacto para validación final.
- Revisión independiente sin defectos críticos pendientes; corrigió validación de tipos y motivó batch acotado. Sin browser E2E nuevo: este ciclo cambia backend; evidencia UI previa corresponde a b32fb03.

## Integraciones y bloqueos concretos
- Supabase consultado solo por metadatos: jfjzpwlrhzqbcrvqxhzf tiene orders/products con columnas/tipos/constraints relevantes compatibles con fixture; uunygxsjzavzmfqfijka no muestra orders. commerce_checkout_sessions no apareció en esos esquemas. No afirmar Supabase integrado o migraciones desplegadas.
- Falta confirmar qué proyecto/entorno corresponde a cada despliegue y ejecutar migraciones en un Supabase aislado compatible, incluyendo RLS/PostgREST/triggers. PostgreSQL sintético no sustituye esa comprobación.
- Sandbox Mercado Pago no ejecutado: sin credenciales de usuario de prueba en runtime local. Docs oficiales Checkout Pro Orders confirman creación con checkout_url y búsqueda GET /v1/orders por referencia y fechas; validación de cuenta/proveedor pendiente. https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/search-orders/get
- Mantenimiento comercial sigue iniciado por administrador; automatización Codex es de desarrollo, no scheduler comercial. No ejecutar búsquedas de clientes reales ni habilitar pagos automáticamente.
- No hay métricas reales suficientes de ventas/conversión/ingresos.

## Siguiente acción segura
1. Verificar CI y preview del commit publicado; corregir fallos antes de integrar.
2. Verificar y corregir importes de envío fraccionario: snapshot SQL inicial y replay pueden diferir por escala/redondeo; primero regresión, sin modificar migraciones aplicadas.
3. Preparar entorno Supabase aislado compatible y recuperación legacy; validar sandbox con usuario de prueba autorizado cuando esté disponible. No usar credenciales reales para simular sandbox.
4. Completar scheduler operativo y administración de tareas manuales bajo configuración autorizada. Mantener disponibilidad false hasta evidencia de cobro y entrega recuperable.
