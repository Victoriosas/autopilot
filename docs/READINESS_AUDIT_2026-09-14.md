# Autopilot: verificación del flujo comercial

Base: GitHub Victoriosas/autopilot, commit 3ef07a7.
Trabajo local: C:/autopilot-github-current, rama codex/autopilot-v4-durable-orchestrator.
C:/autopilot permanece intacto. No se copiaron secretos al checkout nuevo.

## Evidencia actual

- Vercel: deployment de producción READY; dominios correctos.
- API pública: petición sin token devuelve 401 AUTOPILOT_AUTH_REQUIRED; token inválido devuelve 403 AUTOPILOT_AUTH_INVALID.
- Acceso administrativo válido: CHECK_NOT_RUN; AUTOPILOT_ADMIN_TOKEN y AUTOPILOT_CODEX_TOKEN no están disponibles en el entorno local ni en el archivo local inspeccionado. No se rotaron tokens.
- CJ: autenticación y consulta reales satisfactorias usando exclusivamente CJ_API_KEY en memoria.
- Supabase: 0 productos, 156 registros archivados, 0 borradores y 0 órdenes. Solo consultas de lectura.

## Correcciones locales

El cliente usaba keyWord con /product/list. La documentación de CJ especifica productNameEn para ese endpoint. Se corrigió el parámetro; la consulta dejó de devolver el total general de 1532067 productos y devolvió 6793 resultados. La coincidencia sigue siendo amplia: no equivale a selección comercial validada.

Se eliminó el stock ficticio de 999 tanto en búsqueda como en detalle. El stock ausente o inválido ahora queda desconocido; cero se conserva como cero. Se añadieron pruebas de regresión para ambos contratos.

Fuente: https://developers.cjdropshipping.com/en/api/api2/api/product.html

## Límite comercial

Los resultados reales se guardan en CJ_READINESS_EVIDENCE.json como REVIEW_ONLY. No se fabricaron puntuaciones de demanda, fiabilidad, logística ni evidencia para alcanzar draft_ready. La muestra incluye resultados ajenos a la intención y claims que requieren revisión.

No se creó ni aprobó un borrador: falta validar variante, stock, moneda, envío a Uruguay, derechos de imágenes y margen neto. La búsqueda autenticada no acredita estos datos. El método calculateShipping actual además fija peso 0.5 y requiere revisión de su contrato antes de usar sus resultados como evidencia.

No se ejecutó council-review, auto-publish, publicación, compra ni pago real. El token administrativo válido sigue pendiente para verificar el recorrido remoto autenticado. La clave CJ local no demuestra que el entorno Vercel use la misma clave.

## Continuación

1. Probar token administrativo válido desde un entorno autorizado, sin pegarlo en chats.
2. Seleccionar un accesorio no eléctrico y obtener variante, stock y cotización de envío real a Uruguay con el contrato documentado de CJ.
3. Completar costos y evidencia; evaluar oportunidad sin inflar puntuaciones.
4. Crear borrador solo si supera draft_ready y verificar persistencia y consejo sin publicación durante la prueba.
5. Completar reserva de inventario e idempotencia y pagos sandbox antes de habilitar checkout.

Cambios preparados localmente; no desplegados.

## Validación local

- npm test: PASS.
- npm run lint: PASS.
- npm run build: PASS.
- npm run build:vercel: PASS; advertencia de bundle JavaScript mayor de 500 kB.
- npm run test:db: PASS, 13 pruebas PostgreSQL aisladas.
- node scripts/secret-scan.mjs: PASS.
- git diff --check: PASS.

## Pasada de simplificación y eficiencia

Se revisaron timers, polling, cron y workflows antes de cerrar la implementación.

- Polling eliminado: `SourcingPanel` ya no consulta cada 30 segundos; actualiza al cargar y al volver a la pestaña.
- Cron activo: 1, el único ciclo durable de seis horas en `vercel.json`.
- Workflow CI: 1 (`autopilot-core-v4.yml`), sin workflows duplicados.
- Scheduler legado: conservado por compatibilidad, pero bloqueado salvo `AUTOPILOT_LEGACY_SOURCING_ENABLED=true`; no es una vía activa de producción.
- Timers de red: permanecen únicamente timeouts acotados, backoff de rate limit y debounce de interfaz; no programan ciclos de sourcing.
- Llamadas AI: se evitan cuando faltan evidencias deterministas y existe presupuesto por ejecución.
- Código/dependencias eliminados: no se borraron archivos o paquetes sin evidencia de que fueran seguros de retirar.

Resultado: una sola autoridad de ejecución (cron durable), sin polling administrativo continuo y con compatibilidad heredada explícitamente desactivada.
