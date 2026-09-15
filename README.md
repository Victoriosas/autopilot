# Victoriosa Autopilot

Victoriosa es una tienda ecommerce con un motor de sourcing y evaluación asistido por IA. El storefront público y el panel administrativo comparten Supabase como fuente de verdad. El motor Autopilot V4 trabaja sobre un flujo durable y auditable, con CJ Dropshipping como proveedor de sourcing y evidencia de mercado multi-proveedor.

## Estado operativo

- **Producción:** https://victoriosas.online
- **Hosting:** Vercel
- **Base de datos / Auth / Realtime:** Supabase
- **Sourcing principal:** CJ Dropshipping, MCP read-only en Shadow con REST como fallback
- **Market Evidence:** Mercado Libre Uruguay → Gemini Search Grounding → OpenRouter Web Search
- **Modo Autopilot:** Shadow
- **Checkout:** deshabilitado por defecto
- **Compras a proveedor:** bloqueadas
- **Auto-publicación:** bloqueada

Shadow no es una etiqueta visual. Los borradores creados en Shadow quedan marcados de forma permanente como no publicables y deben regenerarse/revalidarse antes de cualquier futura activación comercial.

## Arquitectura Autopilot V4

```text
CJ Discovery
  ↓
normalización + evidencia de variante/stock/flete
  ↓
filtro Victoriosa + riesgo/regulación
  ↓
Market Evidence
  ↓
Pricing Engine
  ↓
Commercial Draft
  ↓
Approval Council
  ↓
Shadow completion / gobernanza de publicación
```

El estado durable de cada run/item vive en PostgreSQL/Supabase. Hay checkpoints, leasing, fencing e idempotencia para poder reanudar una corrida sin repetir efectos laterales.

## Desarrollo local

Requisitos: Node.js 24 y una copia de `.env.example` como `.env.local`.

```bash
npm ci
npm run dev
```

Validación completa antes de merge:

```bash
npm run lint
npm test
npm run build
npm run build:vercel
npm run test:db
```

## Variables críticas

Nunca publiques secretos en issues, commits o chats. Las credenciales viven en el entorno del servidor.

Como mínimo para el entorno real se requieren Supabase y CJ. Los proveedores de Market Evidence son opcionales individualmente, pero Autopilot falla cerrado si no consigue evidencia suficiente.

Para mantener el sistema seguro hasta un release comercial explícito:

```dotenv
CHECKOUT_ENABLED=false
AUTOPILOT_PURCHASE_LIMIT_USD=0
AUTOPILOT_LEGACY_SOURCING_ENABLED=false
AUTOPILOT_V4_SOURCING_ENABLED=false
AUTOPILOT_SHADOW_MODE=true
CJ_MCP_SHADOW_ENABLED=true
```

## Reglas de producción

1. No inventar stock, precio, flete, demanda ni evidencia.
2. `unknown` nunca equivale a cero.
3. Menos de dos comparables de mercado confiables no habilitan pricing comercial.
4. Un fallo de proveedor externo debe degradar al siguiente proveedor o fallar cerrado.
5. Ningún cliente puede activar checkout, compra o publicación pasando flags desde el navegador.
6. El cron de sourcing permanece apagado hasta autorización explícita de producción.
7. El storefront muestra únicamente productos persistidos y realmente publicados en Supabase.

## Directorios principales

- `src/autopilot/`: Autopilot V4, evidencia, pricing, Council y gobernanza.
- `src/services/`: clientes CJ, conectores y servicios de backend.
- `src/components/store/`: storefront.
- `src/components/admin/`: panel operativo.
- `src/payments/`: integraciones de pago, actualmente gobernadas por `CHECKOUT_ENABLED`.
- `supabase/migrations/`: esquema y barreras de seguridad.
- `tests/`: pruebas PostgreSQL del orquestador durable.

## Release

`main` es la fuente de verdad. Los cambios se integran por PR con CI. Vercel despliega `main` a producción únicamente después de que typecheck, tests, build, secret scan y guardrails estén verdes.

La activación de comercio real es una decisión separada del despliegue técnico y requiere una revisión explícita de pagos, fulfillment, regulación, catálogo y métricas Shadow.