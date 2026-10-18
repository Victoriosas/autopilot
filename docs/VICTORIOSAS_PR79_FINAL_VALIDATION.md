# Victoriosas — validación final de PR79

Fecha: 2026-10-18, America/Montevideo. Base solicitada: **a16cc9a8e7c8a166f6cbcfcf67a9509076a0014d**. Worktree C:/autopilot-worktrees/diseno. Se hizo fetch y fast-forward; capturas modificadas y archivos sin seguimiento previos se preservaron. No se reinició trabajo ni se modificaron textos aprobados, fotografías, backend, Supabase, credenciales, pagos o automatizaciones.

## Dictamen

**Apta técnicamente para revisión final e integración con un nuevo build production**, siempre que se mantengan cerrados los formularios y los cobros y se respete la aprobación del propietario. No se detectaron regresiones funcionales, visuales, de accesibilidad automática o de seguridad en el alcance comprobado. Esto no significa ausencia absoluta de riesgos ni validación integral de reservas, administración o prestación profesional.

**No promover el artefacto Preview:** contiene la bandera de revisión editorial fijada al compilar. La versión productiva debe reconstruirse con VERCEL_ENV=production, comprobar exclusión de ambos borradores y luego auditar el dominio. PR79 permanece sin fusionar; publicación productiva pendiente de decisión humana. No hay aprobación de lanzamiento editorial, campañas ni captura de información sensible.

## SHA original y GitHub Actions

Para a16cc9a, Core v4 PR run **39094716905** y push run **39094713664** terminaron SUCCESS: validate (tipos/tests/builds/secret scan) y postgres (suite y replay canónico). Vercel SUCCESS. Supabase Preview SKIPPED por no tener rama asociada; no es prueba superada ni implica persistencia alojada.

Preview original READY: https://autopilot-395cg6dzm-autopilot12.vercel.app, deployment dpl_DMj5H2693D6JyxocfUK5voG4eL1w. /api/health confirmó el SHA exacto durante Playwright. Las pruebas y este informe amplían evidencia sin cambios en componentes públicos; el SHA definitivo y sus CI/preview se registran en la descripción de PR79 para evitar atribuir al nuevo head pruebas hechas solo en a16cc9a.

## Fidelidad al texto aprobado

PR80 está MERGED hacia la rama de PR79. Su commit 965f1c8a43c2568db458401c56547fe885bcb638 y a16cc9a tienen idéntico árbol Git: **490c3bfdf0f0f4ffc272bc87a7d83b235c88ac44**. No hay omisiones, añadidos ni reformulaciones frente a esa aprobación. Ninguna corrección ortográfica adicional fue necesaria.

Se verificaron en el DOM 29 bloques de texto estático, además del H1 y la descripción editorial. Fixture tests/approved-copy-pr80.json identifica PR/commit de aprobación; approvedCopy.test.ts protege el texto en componentes y scripts/verify-approved-copy.cjs lo comprueba en navegador. La descripción más reciente de PR80 reemplaza la descripción editorial anterior por decisión del propietario; no se restaura la versión previa.

## Matriz de aceptación

| Área | Evidencia | Resultado y límite |
|---|---|---|
| Inicio desktop/tablet/móvil | 1440, 768, 390 y 320 px, capturas e inspección visual | Sin overflow, un H1, imágenes cargadas, anchors válidos |
| Fotografías | picture/source a 700 px; recurso horizontal/vertical correcto | Sin editar fotos ni deformar; recorte CSS preservado |
| Evaluación remota | Hero, proceso, FAQ y WhatsApp | Primer contacto → evaluación remota → decisión individual; sin domicilio, tarifas ni reserva automática |
| Textos | Comparación árboles Git + 29 textos DOM + H1/description | Coincidencia exacta con aprobación PR80 |
| Editorial | Categoría, lectura, relacionada, categoría vacía y slug inexistente | Flujo funcional en preview; CTA a WhatsApp sin enviar mensajes |
| Dos borradores | Modelo status=draft, date=null + tests + build production local | No tarjetas de borrador ni sus URLs directas en build productivo |
| Accesibilidad | axe-core 4.14.0: wcag2a/2aa/21aa/22aa y best-practice | Seis vistas, 0 violations y 0 incomplete; 32–35 reglas aprobadas por vista. No certifica WCAG completa |
| Teclado | Tab desde entrada, salto #contenido y FAQ | Enlace de salto alcanzable y FAQ operable |
| Administración | /admin, /admin/, /beauty-professional, /beauty-professional/ y HTTP | Pantallas privadas; API admin 401; profesional 503 cerrado. No login autorizado real |
| Privacidad | Interceptación preventiva de escrituras durante navegación | 0 escrituras de aplicación; almacenamiento comercial preservado |
| Formularios | GET config y POST vacío de prueba | Requests deshabilitado; intake y waitlist 503, sin datos personales |
| Comercio histórico | Sin enlaces públicos comerciales, health checkout=false | Código interno preservado; pagos no activados ni probados como operativos |
| Dependencias/secretos | npm audit --omit=dev + secret scan | 0 vulnerabilidades reportadas y sin secretos detectados; alcance del escáner no es garantía absoluta |
| Tipos/tests/builds | npm run verify local | **186/186** pruebas, TypeScript y builds servidor/Vercel aprobados |

## Regresiones de pruebas corregidas

1. El script usaba la pregunta FAQ anterior, ya reemplazada por texto aprobado. Se actualizó el selector a “¿Cómo inicia la atención?” sin alterar copy.
2. La toolbar de Vercel hace POST de validación de sesión a vercel.live/login/validate. La prueba lo confundía con escritura comercial. Ahora identifica solo ese origen/path como infraestructura de preview, sin relajar la intercepción de escrituras de la aplicación o de Supabase. Se registran por separado las solicitudes de infraestructura. Un finally retira la intercepción incluso si la prueba falla.
3. El guard productivo ahora verifica las **dos** URLs de borrador. Se ampliaron controles a slash final de rutas privadas, prefijo editorial inválido y recepción Beauty cerrada.

## Rendimiento: laboratorio, no usuarios reales

Medición visible en Chromium de la preview, viewport móvil 390x844, caché de cliente deshabilitada, latencia 150 ms, 1.6 Mbps bajada/0.75 Mbps subida y CPU4x. Tres muestras:

| Muestra | LCP | CLS | FCP | Transferencia de recursos |
|---|---|---|---|---|
| 1 | 1044 ms | 0 | 1044 ms | 337501 bytes |
| 2 | 1020 ms | 0 | 1020 ms | 337501 bytes |
| 3 | 1028 ms | 0 | 1028 ms | 337501 bytes |

LCP mediano **1028 ms**, inferior al objetivo de laboratorio 2500 ms; CLS observado 0. El LCP móvil corresponde al elemento visible más grande, no necesariamente a toda la fotografía. No representa la diversidad de dispositivos o redes ni prueba métricas de campo. En navegación con caché y sin throttling se observaron LCP 212–284 ms en home; no se usan como estimación general. **INP real y Core Web Vitals de campo no medidos**, por falta de tráfico representativo. No hay ventas/reservas/conversiones nuevas que reportar.

Axe se descargó como paquete npm axe-core@4.14.0 con scripts de instalación deshabilitados y se inyectó solo en la sesión de auditoría; no se agregó dependencia ni código de terceros al sitio. No se instalaron píxeles.

## Evidencia

Capturas aprobadas: output/playwright/approved-copy-{1440,768,390,320}.png y approved-copy-article.png. JSON: approved-copy-proof, approved-release-browser, approved-release-quality, approved-release-cold-performance y approved-production-guard, todos dentro de output/playwright. Los originales locales previos no se sustituyeron.

Producción consultada por API Vercel permanece en main **1d647a2**, deployment dpl_37HpoTcfmwMmd3UWkY1dYB6EdBKg READY. No se ejecutó merge/promote/deploy productivo. La nueva preview mantiene protección.

## Pendientes antes y después de publicar

- Revisión/aprobación final del propietario y CI completa del head definitivo; no fusionar automáticamente.
- Reconstrucción production y guard de borradores; verificar dominio, fotografías, WhatsApp, headers y accesos cerrados después de publicar. No promover preview.
- No se ha probado recepción humana de WhatsApp, sesión administrativa/profesional autorizada ni operación real de evaluaciones. La web ofrece contacto, no un sistema de reservas validado end-to-end.
- No habilitar formularios sensibles hasta completar privacidad, retención y operación autorizada. No habilitar cobros.
- Lanzamiento editorial: aprobar cada texto/fuentes/fecha y capacidad de atención antes de cambiar draft a published o programar Metricool. Ver docs/EDITORIAL_LAUNCH_READINESS.md; no duplicar el calendario existente.

## Siguiente prompt y avance seguro

“Una vez aprobada y publicada la web, ejecutar el checklist de lanzamiento editorial enlazado, revalidar conexiones Metricool por lectura, revisar los dos borradores y sus fuentes, obtener aprobación de fecha/texto/canales y validar capacidad para responder evaluaciones remotas. Mantener toda programación, envío y captación sensible bloqueados hasta autorización. Mientras tanto, preparar solo controles y materiales internos.”

Avance seguro realizado: fixture del copy aprobado, regresión DOM, guard de ambos borradores, auditoría accesible/de laboratorio y checklist editorial de aprobación. Sin automatización nueva ni campañas.
