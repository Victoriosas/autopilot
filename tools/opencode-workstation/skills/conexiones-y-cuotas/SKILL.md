---
name: conexiones-y-cuotas
description: Comprobar GitHub, Vercel, MCP, proveedores o diagnosticar límites y credenciales.
---

Usar ops/status para presencia, github y vercel en lectura. Usar operaciones para salud del gateway. La presencia de una variable no prueba autenticación. No imprimir tokens ni entornos. GitHub usa gh del usuario; Vercel puede estar en otra cuenta: verificar proyecto y equipo antes de actuar. Context7 y Playwright son conexiones independientes. Supabase, Resend y camelRun necesitan acceso local explícito; no extraer credenciales de sesiones de ChatGPT. Consultar cuenta/plan antes de asumir gratis. Ante 429 no repetir sin fin: respetar retry-after, reducir contexto y guardar checkpoint. Cerebras queda deshabilitado por coste no confirmado.
