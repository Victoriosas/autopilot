# SEO por ruta: implementación segura

Relacionado con #84. No publicar automáticamente.

## Hallazgo confirmado
`index.html` contiene canonical y `og:url` fijos en `https://victoriosas.online/`. En una SPA con fallback a index, las rutas editoriales pueden compartir esos metadatos, lo que requiere corrección.

## Tarea para Codex/ECC
1. Inspeccionar router, estrategia de renderizado y hosting de Vercel antes de elegir implementación.
2. Dar a `/de-mi-para-ti` canonical absoluto propio y metadatos de título, descripción, og:title, og:description y og:url coherentes. Mantener `/` con canonical a la raíz.
3. Asegurar que el HTML inicial que reciben crawlers contenga los metadatos por ruta: evaluar prerender o generación estática de rutas públicas; no confiar exclusivamente en cambios de DOM del navegador.
4. Revisar otras rutas indexables y sitemap. Evitar indexar páginas privadas, borradores y rutas no publicadas.
5. Verificar respuesta HTTP, HTML servido, metadatos, rutas directas, accesibilidad, pruebas y build; documentar evidencia.
6. Revisar CTA móvil de WhatsApp y su texto de evaluación inicial remota, sin activar reservas ni mensajes automáticos.

## Límites
Trabajar en rama, preparar PR en borrador y esperar revisión para fusionar o desplegar. No cambiar DNS, credenciales, cobros, campañas ni contenidos publicados.
