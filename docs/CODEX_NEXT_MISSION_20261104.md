# Continuación Codex | Victoriosas Autopilot | 2026-11-04

Este documento es el **prompt operativo breve y verificable** para retomar Victoriosas después del laboratorio sintético. No sustituye `AGENTS.md`.

## Objetivo y estado contrastado

Conseguir la verificación completa de consultas y del laboratorio de agentes **sin envíos reales**.

- `main` auditado: `f28bac68017c1eb55bad8bf5ebd932443f27c4f2` (volver a comprobar SHA antes de actuar); Vercel producción READY en ese SHA.
- `GET /api/health`: HTTP 200, `runtime=vercel`, comercio deshabilitado.
- `GET /api/beauty/inquiries/config`: HTTP 200, `enabled=true`, privacidad `consultation-v1`, retención 30 días.
- Navegador/scrape de `/consultanos`: llegó a mostrar «formulario temporalmente sin conexión». **No asumir que la API sana equivale a recorrido funcional**. Inspección interactiva externa agotó tiempo; causa no demostrada.
- Supabase principal: `jfjzpwlrhzqbcrvqxhzf`; 39 migraciones instaladas. Falta `20261104030000_consultation_service_knowledge.sql`, `private.consultation_service_knowledge` aún no existe y `beauty_services` contiene 4 filas, no 17 fichas privadas completas.
- En camelRun existen `victoriosas-lab-comprension-free`, `victoriosas-lab-redactor-free`, `victoriosas-lab-guardian-free`; están definidos, no constituyen un pipeline en ejecución continua. Integración real sigue sin verificar.
- Resend: dominio autenticado y envíos históricos; **no se probó entrega de una consulta nueva en esta misión**.
- El PR de continuación preserva el modo *simulación sin fichas*: ante esquema privado inaccesible, `Probar IA` usa **cero hechos** y muestra advertencia, mientras que el editor de fichas sigue bloqueado. Nunca presentar esto como integración real.
- Codex local de Windows tenía los MCP `camelrun` y `victoriosas-supabase` autenticados con OAuth y 7 skills; Codex Cloud requiere sesión y permisos separados. Remote Desktop puede estar desconectado.

## Misión de Codex: ejecutar una prioridad cada vez

1. **Comprobar entorno.** Leer `AGENTS.md`, `docs/CODEX_SKILLS.md`, `docs/CONSULTATION_LAB.md` y esta nota. Verificar rama, diff, CI y MCP disponibles en **esta sesión**, sin presuponer que una sesión anterior comparte accesos. Activar `$victoriosas-codex-ahorro-tokens` y `$victoriosas-consultas-e2e` solo cuando proceda.
2. **Formulario P0.** Reproducir en navegador local/preview la contradicción entre config=habilitado y mensaje de falta de conexión. Registrar código HTTP, tiempos, consola y contrato JSON sin PII. No enviar POST al sitio de producción. Corregir la causa demostrada y añadir prueba de navegador reproducible. Prohibido eliminar verificaciones de disponibilidad o habilitar envío sin config.
3. **Laboratorio P0.** Confirmar que «Probar IA» funciona con casos sintéticos y sin conocimiento privado, informando honestamente el fallback. Validar Auth, origen, Guardián, no-envío, cero datos de clientes; no confundir una simulación con el modelo real.
4. **Supabase P1.** Validar migración de 17 fichas de forma desechable, verificar privilegios, Auth/RLS y versiones. Preparar la secuencia aditiva y reversión para instalación remota, **pero no ejecutarla** sin autorización concreta. Investigar el aviso `public.beauty_purge_expired_requests()` con EXECUTE a authenticated y preparar mitigación comprobada; no revocar permisos a ciegas.
5. **camelRun P1.** Mediante `$victoriosas-camelrun-laboratorio`, comprobar acceso, documentación y estructura JSON. Ejecutar modelos externos exclusivamente sobre casos sintéticos después de confirmar **coste total cero (modelo, runtime, herramientas, almacenamiento y red)**. Si no se puede verificar, detener ejecución externa y continuar con mocks. Ningún nombre, celular, correo ni consulta real llega al proveedor.
6. **Integración P2.** En un PR independiente y pequeño, diseñar conexión del pipeline de laboratorio Comprensión → Redactor → Guardián → validación determinista → borrador revisable. Si no hay coste o permisos demostrados, dejarla desactivada. No habilitar envíos, cron ni producción.
7. **Validación.** `npm run verify`, casos adversariales congelados, PostgreSQL y Supabase local cuando corresponda, CI del SHA final y revisión humana. Informar exactamente cuál de *DEFINIDO / PROBADO / FUSIONADO / DESPLEGADO / EJECUTADO* aplica.

## Economía de tokens y límites

- GPT-6.1 Sol, razonamiento Medium, velocidad Standard **si ese modelo está disponible**; no alterar otras preferencias globales.
- Buscar símbolos, leer archivos concretos y comparar diferencias, no repetir el historial entero.
- Máximo 400 palabras de checkpoint y 180 palabras por fase, incluyendo rutas, tests, SHA y obstáculos reales.
- Sin pagos, gastos, modelos pagos, autoenvíos, campañas, precios públicos, cambios de DNS, modificación de secretos, SQL remoto no autorizado ni fusiones/despliegues manuales.
- La misión termina con PRs pequeñas, pruebas, matriz de estado y bloqueos. No afirmar completada la operación de agentes sin prueba real.

## Estado de traspaso y prioridad inmediata

**Primera tarea:** reproducir/corregir el falso «sin conexión» del formulario con prueba de navegador y verificar el cambio de fallback sin tabla privada. No dedicar tokens a migrar ecommerce histórico, construir un SaaS nuevo ni añadir más agentes antes de cerrar este circuito.
