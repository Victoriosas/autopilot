# Operación y herramientas verificadas

Inventario 17/10/2026, específico de este runtime Codex. No copiar tokens de ChatGPT ni de aplicaciones.

| Capacidad | Estado y prueba |
|---|---|
| ECC 2.2.3 | 71 perfiles de agentes y 311 directorios de skills observados. Guide, Epic Decompose/Claim/Review, Build Fix y Auto Update leídos. Auto Update dry-run no encuentra install-state; no actualizó herramientas. No equivale a ejecutores Claude instalados. |
| Agentes Codex | Delegación `beauty_review` ejecutada; SQL/tests aislados y revisión del código del principal. |
| GitHub | `gh pr view 72`: OPEN, draft, SHA a38ff01; Core y Supabase aislada success, Supabase Preview skipped. No atribuir esa CI al código Beauty nuevo. |
| Supabase | Conector probado: dos proyectos ACTIVE_HEALTHY. jfjzpwlrhzqbcrvqxhzf no tiene beauty_requests ni commerce_checkout_sessions; products=0; rama main MIGRATIONS_FAILED. Sin migraciones remotas. |
| Vercel | get_project probado: autopilot / autopilot12, dominio victoriosas.online, último producción READY dpl_4FG4VzeNfCQau4PX3xiUZd3AURGZ. Sin promoción. |
| Firecrawl | Consulta de saldo probada en cuenta Primary: 1005 créditos restantes; no scraping de pago ni monitor nuevo. |
| vicmc | get_category_tree leído con respuesta real; acceso de catálogo probado, no checkout ni compras. |
| Remote Desktop Commander | list_devices devuelve micahael-PC Online. Inventario probado; no se ejecutaron comandos por ese conector. |
| Gmail, Calendar, Contacts, Drive | get_profile de los cuatro probado; corresponden a trabajosrapidos.uy@gmail.com. No es el correo nuevo de Victoriosas. No mensajes, contactos ni eventos creados. |
| Configuración MCP local | Secciones viki, supabase, node_repl, mercadolibre-mcp-server, dsers observadas sin imprimir valores secretos. Instalación/configuración no prueba cada servidor. |
| PostgreSQL local | Ejecutable 18 disponible; clústeres desechables de Beauty probados y detenidos. |
| Docker/Podman local | No encontrados en PATH en esta comprobación; Auth/PostgREST reales se delegan al runner desechable de CI. |
| Coordinación Epic | Skills instaladas; no hay epic seleccionado ni script de coordinación del repo verificado como operativo. No se invocó CLI inexistente. |

## Habilitación futura, no ejecutada

1. Revisar y aplicar exclusivamente la migración Beauty con respaldo/reversión y aprobación explícita; no `db push` indiscriminado del historial legacy.
2. Validar cuentas administradoras existentes sin inventar una nueva identidad ni elevar roles desde el cliente.
3. Completar retención y protección ante abuso; verificar datos y condiciones comerciales con Sofía.
4. Configurar `PUBLIC_APP_URL` para el origen exacto y `BEAUTY_REQUESTS_ENABLED=true` solo en entorno autorizado. Si falta config/base, el sitio no afirma recepción.
5. Desplegar versión revisada tras aprobación específica; comprobar móvil, servidor, administración y acceso RLS. Mantener pagos apagados.

El correo sigue pendiente por preferencia del propietario. Google Calendar y correos no se activan para reservas automáticamente. Ningún perfil conectado implica autorización para mensajes comerciales.

Actualizaciones ECC: release remoto consultado por GitHub = v2.2.3, coincide con paquete local. Auto Update dry-run sin install-state: no hubo pull ni reinstalación.

No disponibles como integración API ejecutable comprobada: WhatsApp Business/Meta para automatizar mensajes, nuevo buzón de marca y coordinador Epic del repositorio. El navegador permite edición manual de redes, lo cual no equivale a esas APIs. No se instalaron herramientas para suplirlas.

## Catálogo y evaluación — ciclo actual

Ver [contrato y habilitaciones](BEAUTY_SERVICES_CATALOG.md). Nuevos controles de catálogo y espacio profesional desactivados por defecto. El paquete offline ahora incluye tres migraciones Beauty; no ejecuta ninguna. `beauty_publication_control` requiere operación owner autorizada y queda false. Membresías profesionales no se administran por CRM ni se concedieron alojadas. El coordinador local incorpora una tercera comprobación aislada de catálogo/evaluación; no se modificó ni duplicó el scheduler de seis horas. Los inventarios anteriores son evidencia fechada, no saldo ni estado actual garantizados.
