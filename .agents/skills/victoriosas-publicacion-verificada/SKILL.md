---
name: victoriosas-publicacion-verificada
description: Revisar PR, CI y despliegues de Victoriosas en GitHub y Vercel, verificar SHA, dominio y API, y diagnosticar Cloudflare como respaldo sin cambios de producción no autorizados. Usar ante pedidos de deploy o sincronización.
---

# Entrega segura GitHub → Vercel

## Antes de actuar
1. Leer `AGENTS.md`, comprobar `git status`, rama, HEAD, PR abiertas y revisiones pendientes. Preservar cambios ajenos.
2. Contrastar estado del commit con GitHub Actions `validate`, `postgres` y pruebas de navegador aplicables. CI verde del SHA anterior no valida el SHA nuevo.
3. Examinar Vercel: proyecto `autopilot`, destino, commit, rama, build, READY o ERROR y alias `victoriosas.online`.
4. Variables de entorno: comparar SOLO nombres, entornos y presencia; nunca solicitar, imprimir, copiar ni registrar valores de secretos. No introducir credenciales en un prompt.

## Reglas de lanzamiento
- Por defecto preparar rama y PR. No auto-fusionar ni hacer deploy/promoción manual. Si el usuario autoriza expresamente producción, validar primero todos los controles y confirmar que la acción exacta está autorizada.
- Un PR fusionado no es lo mismo que una versión publicada. Comprobar que el `/api/health` público indique el SHA previsto y que config/formulario/panel respondan según su seguridad.
- `HTTP 200` de la portada no acredita envío de Resend, Auth, Supabase ni procesamiento IA. Cada integración requiere prueba independiente.
- Cloudflare es respaldo: sin modificaciones de DNS, rutas Worker, variables, dominio principal ni claves sin autorización específica.
- Conservar checkout deshabilitado y nunca reactivar comercio histórico.

## Salida
Informe breve: SHA en GitHub, SHA en Vercel, estado CI, URL de PR/despliegue, rutas verificadas y no verificadas, fallos y riesgos. No afirmar producción nueva sin evidencia.
