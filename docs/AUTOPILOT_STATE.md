# Victoriosa — continuidad

Actualizado: 2026-10-10, America/Montevideo. Consultar primero este archivo y verificar Git antes de una nueva auditoría. Continuar tareas seguras durante la sesión; no asumir ejecución después de cerrarla.

## Rama y referencia
- Rama: `codex/autopilot-v4-durable-orchestrator`; último commit de código/pruebas: `c8b4885`.
- GitHub verificado con `git ls-remote`: main `c074795`, rama remota `9d47c10`. Sin push, merge ni deploy.
- Trabajo ajeno preservado: `.audit/`, `.playwright-cli/` y scripts raíz sin seguimiento.

## Estado comprobado
- React/Vite + Express; `mountAutopilotV4` conecta OAuth Mercado Libre, waitlist, pagos, sourcing, gobernanza y control plane. Persistencia Supabase; no implica que todas las integraciones funcionen en producción.
- Producción: GET `https://victoriosas.online/api/health` devolvió HTTP 200, commit `c07479554a329f28aa53fd5d3d919315f433de80`, `checkoutEnabled: true`. El README describe el valor por defecto, no el estado vivo. No se realizaron operaciones de compra/pago.
- GET público `/api/payments/v2/config`: checkout true, PayPal false, transferencia false. `/api/payments/mercadopago/config`: configured true. Son flags de configuración, no validación bancaria ni de pagos.
- ECC instalado en caché `ecc/ecc/2.2.3`; `skills/tdd-workflow/SKILL.md` leído y aplicado. Detector seleccionó npm; runner real Node test + tsx. [Repositorio oficial consultado](https://github.com/affaan-m/ECC). No se instalaron hooks ni se alteró configuración global. Compatibilidad verificada únicamente para el flujo TDD usado.

## Cambios y evidencia TDD
| Cambio | RED | GREEN / garantía |
|---|---|---|
| Stock de carrito sin coerción | `e51f6c8`: 2 fallos | `4f4633a`: 6 pasan; strings/booleanos no crean stock; cobertura 100% |
| Cookie OAuth malformada | `9e165f0`: URIError | `6078d05`: HTTP 400 controlado; test incorporado a npm test |
| Configuración waitlist inválida | `1f14578`: error Supabase URL sin manejar | `b301a65`: HTTP 503 controlado |
| Pruebas aisladas de integraciones | `9f40635` | Autorización admin, cookie HttpOnly/Secure/SameSite, tokens cifrados, error OAuth 502, consentimiento, persistencia y errores waitlist |
| Readiness Mercado Pago | `14e4f04`: USD se anunciaba disponible | `4435d0e`: moneda UYU y URL válida/HTTPS en producción antes de anunciar disponibilidad |
| Integridad conciliación Mercado Pago | `7b21053`: importe abonado `"Infinity"` confirmaba orden | `30d2deb`: importes finitos/no negativos y total positivo antes de actualizar pago |
| Checkout y errores de proveedor | `c8b4885` | Precio servidor ignora monto cliente, stock insuficiente impide proveedor, órdenes pendientes; fallos lookup/insert/bind/proveedor y retry webhook controlados |

Comandos verificados:
- `npm test`: 82 pasan, 0 fallos, 0 omitidas. `npm run lint`: exit 0 en la revisión final.
- `node --import tsx --test --experimental-test-coverage --test-coverage-include=src/integrations/mercadoLibreRouter.ts src/integrations/mercadoLibreRouter.test.ts`: líneas/funciones 100%, ramas 84.62%.
- Comando equivalente para `src/storefront/waitlistRouter.ts`: líneas/funciones 100%, ramas 94.12%. Cobertura de módulos, no del repositorio completo.
- `node --import tsx --test --experimental-test-coverage --test-coverage-include=src/payments/mercadoPago.ts src/payments/mercadoPago.test.ts src/payments/safety.test.ts`: 8 pasan; líneas 97.75%, ramas 81.08%, funciones 90.91%.
- `npm run build:vercel`: exit 0 con todas las correcciones de producción. Build Node pasó en el ciclo anterior del carrito. Advertencia existente: bundle principal 590.25 kB.
- Revisión independiente: OAuth/waitlist sin hallazgos; 7 pruebas de pagos pasaron. Se atendió la sugerencia de probar totales no finitos/discrepancias; revisión final de los tests ampliados sin nuevos hallazgos. `git diff --check`: correcto.
- Proveedores simulados con credenciales ficticias; ningún token real ni escritura de clientes. No se ejecutaron pruebas PostgreSQL ni browser E2E.

## Bloqueos y decisiones
- Comercio real no validado: el flag checkout activo no demuestra pagos sandbox, reserva de stock, fulfillment ni readiness del catálogo. En `mercadoPago.ts`, precio/stock se leen y la orden se inserta por separado; no se observó reserva atómica en ese flujo. Riesgo de sobreventa concurrente pendiente. No inventar ingresos ni métricas.
- Mantener Shadow y barreras de publicación/compra; no migraciones destructivas, cambios de credenciales, DNS ni pagos sin autorización explícita.
- La auditoría integral ECC/arquitectura del adjunto todavía no está completa. Usar evidencia existente y búsquedas específicas, no repetir auditoría general.

## Próxima prioridad
Diseñar reserva atómica e idempotencia de checkout con criterios de aceptación y base PostgreSQL aislada, antes de modificar persistencia de órdenes. Confirmar contrato real Mercado Pago en sandbox autorizado; no confundir mocks con validación del proveedor. No habilitar ni modificar producción. Documentar solo cambios relevantes aquí.

Criterios para el próximo RED de concurrencia: dos compradores compiten por una unidad y solo uno reserva; retry con la misma clave devuelve la misma orden sin una segunda reserva; cantidades/precio/currency se validan dentro de la transacción; fallo/expiración libera stock una sola vez; callback repetido confirma una vez y conserva trazabilidad. Primero inspeccionar constraints/RPC existentes en migraciones y crear pruebas con rollback en una base aislada, nunca contra clientes reales.
