# Victoriosas Beauty: ejecución y continuidad

Estado 17/10/2026. Rama `codex/beauty-requests-20261017`, basada en `a38ff01`. No desplegar producción ni aplicar SQL alojado sin revisión de alcance.

## Cola y responsables

| Tarea | Responsable real | Dependencias | Estado / aceptación |
|---|---|---|---|
| Inventario de herramientas | Codex principal | Acceso de lectura | Verificado; ver operaciones |
| Contrato de consulta mínima | Codex principal | Política de privacidad | Tests HTTP y frontend pasan |
| Persistencia y RLS | Agente `beauty_review` | PostgreSQL aislado | 7/7 pruebas reales locales; sin SQL remoto |
| Bandeja administrativa | Codex principal | Supabase Auth existente + migración Beauty | Implementada; integración real de Auth pendiente de CI |
| Revisión independiente | Agente `beauty_review` | Código nuevo | Tres defectos detectados/corregidos; tests de regresión |
| Supabase Auth/PostgREST aislado | GitHub Actions | Push de rama revisable | Workflow dedicado; no usa proyecto alojado |
| Retención física y solicitudes de retiro | Codex / propietario | Política aprobada y cuenta operadora | RPC de vencidas preparada y probada 8/8; operación alojada y retiro por solicitud pendientes |
| Catálogo administrable | Codex / Sofía | Aprobación de protocolos y tarifas | Siguiente fase; ficha actual es propuesta estática no aprobada |
| Producción | Propietario + Codex | Pruebas, revisión, migración y alcance aprobados | Bloqueada por autorización específica |

Epic Decompose/Claim/Review disponibles como skills migradas, pero requieren issue y `scripts/github-coordination.js`. No se inventó un epic ni se ejecutaron comentarios/etiquetas. La delegación efectiva usa agentes Codex con archivos asignados y revisión independiente. No existe ejecución automática de perfiles OpenCode/Claude desde Codex por el solo hecho de tener sus markdown.

## Coordinador sostenible

`node scripts/beauty-coordinator.mjs --status` inspecciona dos tareas. `--run-next` ejecuta una sola tarea permitida, con lock, timeout, huella de archivos para revalidar cambios y evidencias en `.audit/beauty-coordinator/`. No modifica aplicación, agenda, credenciales, dominio o base alojada. No crea scheduler. Automatización existente `victoriosa-autopilot-6h` observada ACTIVE; no modificada ni duplicada. Revisar lock/proceso antes de recuperación manual, nunca borrar un lock activo por suposición.

## Siguiente instrucción

Comprobar CI del SHA de esta rama y corregir únicamente fallos reproducibles de Beauty. Validar el recorrido con Auth/PostgREST desechables; después completar retención física y pruebas administrativas sin usar clientes reales. Preparar catálogo con estados borrador/pendiente/aprobado/publicado sin publicar servicios avanzados. Mantener `BEAUTY_REQUESTS_ENABLED` ausente/false en producción. Conservar los cambios locales ajenos y solicitar autorización solo para un paquete de migración/despliegue concreto ya revisable. No crear automatizaciones nuevas.

## Ciclo catálogo administrable y evaluación profesional

Implementación: catálogo con versiones, precios pendientes y publicación cerrada; DTO público integrado al formulario existente; evaluación privada por profesional y consentimiento separado; CRM con referencia de ficha y condiciones históricas. Revisiones independientes detectaron y corrigieron permisos PATCH, bypass de publicación directa, fichas no disponibles visibles por PostgREST, sesión privada sin refrescar y falta de identificación de ficha en CRM.

La siguiente instrucción y los requisitos operativos están en [BEAUTY_SERVICES_CATALOG.md](BEAUTY_SERVICES_CATALOG.md). La siguiente tarea segura será preparar el paquete comercial offline de aprobación, sin publicar tarifas ni obtener consentimiento por inferencia.
