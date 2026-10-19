# Victoriosas.online - estado de liberacion 2026-10-17

## Dominio y configuracion

Dominio principal confirmado por el propietario: https://victoriosas.online. Vercel proyecto autopilot, team autopilot12, dominio verified=true. Canonical, Open Graph, JSON-LD, robots y sitemap ya apuntaban a este dominio. No se cambiaron registros DNS.

Vercel Production: PUBLIC_APP_URL=https://victoriosas.online y CHECKOUT_ENABLED=false. Misma configuracion no secreta aplicada a .env.local sin sustituir credenciales. Los cambios Vercel requieren un nuevo despliegue.

Redeploy de configuracion solicitado: dpl_4FG4VzeNfCQau4PX3xiUZd3AURGZ; usa exactamente el commit productivo previo a85a59b40f7c643f8e88e71c50699bf5091a0fb8. No incluye las funciones nuevas de la preview. Verificar READY y GET publico antes de declarar aplicada la configuracion.

## Codigo nuevo

Commit funcional a38ff0150ebe768a1abd48159f8f6925fe3c4351 publicado en PR #72: https://github.com/Victoriosas/autopilot/pull/72. Preview READY: https://autopilot-ndk0rxu21-autopilot12.vercel.app.

Consolida catalogo manual/afiliados, Firecrawl, diagnostico CJ y navegacion de catalogo. El indicador comercial exige disponibilidad verificada del checkout atomico; tener una clave de pago ya no basta. Se conserva la revision humana de publicacion.

Validado: TypeScript; 166/166 pruebas locales; build servidor y build Vercel, exit 0; escaneo de secretos; replay canonico PostgreSQL desechable 1/1. El primer wrapper PowerShell interrumpio por stderr de la advertencia de bundle; se repitieron ambos builds con npm.cmd y finalizaron exit 0. Sigue la advertencia preexistente de bundle mayor de 500 kB.

CI Core v4: runs 39023073856 y 39023070258 success para a38ff01. Supabase aislado run 39023070260 pendiente al preparar este documento. Preview /api/health y /api/payments/mercadopago/config responden 200, commit exacto, checkoutRequested=false, checkoutEnabled=false y CHECKOUT_DISABLED. robots apunta a victoriosas.online.

## Bloqueos actuales comprobados

- CJ local: lectura real devuelve HTTP 401, codigo CJ_REST_ONLY_CJ_API_1600005. Necesita clave autorizada o autorizacion de API/tienda en CJ. No se imprimieron claves.
- Supabase jfjzpwlrhzqbcrvqxhzf activo. Historial consultado hoy conserva 21 versiones hasta 20260917040051. La rama main reporta MIGRATIONS_FAILED. products tiene 0 filas; las tres funciones comerciales consultadas no existen.
- El script scripts/prepare-hosted-commerce-review.mjs genera un paquete offline con seis SQL forward-only existentes, hashes SHA256 verificados y manifiesto; no enlaza ni ejecuta SQL. Paquete generado en C:\Users\micahael\AppData\Local\Temp\autopilot-hosted-review-exvvFH. No usar el directorio legacy de 24 migraciones para db push al proyecto alojado.
- No hay evidencia nueva de pago sandbox real ni de fulfillment completo. La compra automatica al proveedor sigue bloqueada.

## Continuacion concreta

1. Confirmar redeploy READY y GET publico con checkoutRequested=false; conservar el SHA actual si falla.
2. Obtener resultado final de CI aislada de a38ff01 y revisar preview antes de fusionar/promover funciones nuevas.
3. Para Supabase: respaldo verificable y procedimiento de restauracion, comparar esquema/historial actual con replay, revisar los seis SQL y grants, preparar la ventana de aplicacion; no confundir el paquete offline con una migracion ya aplicada o autorizada.
4. Autorizar/reemplazar credencial CJ en canal seguro, repetir scripts/check-cj.mjs, cotizar variantes reales a Uruguay. Alternativa operativa: proveedor local con condiciones documentadas o afiliacion aprobada.
5. Completar 3-5 ofertas con stock, costo final, margen, entrega, imagenes autorizadas y condiciones. No inventar precios ni publicar candidatos bloqueados.
6. Validar usuarios y credenciales de prueba del proveedor, pago/webhook/idempotencia/recuperacion, pedido y entrega manual; solo despues revisar habilitacion comercial.

No se aplico SQL remoto, no se habilitaron pagos reales, no hubo compra, publicacion de productos ni cambios de credenciales de proveedores. El dominio victoriosa.click queda fuera del plan operativo; su recuperacion no es requisito de esta tienda.

## Verificacion final
Redeploy dpl_4FG4VzeNfCQau4PX3xiUZd3AURGZ READY y dominio victoriosas.online asignado, sin aliasError. GET publico /api/health confirma SHA a85a59b y checkoutRequested=false, checkoutEnabled=false, CHECKOUT_DISABLED. CI Supabase aislado 39023070260 completo en success para a38ff01; ambas CI Core tambien success. Las funciones nuevas permanecen en PR72/preview y no se promovieron.
