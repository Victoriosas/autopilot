# Mejoras a partir del plan y ZIP adjuntos · 23 de octubre de 2026

## Alcance y procedencia

Solicitud del propietario: usar los archivos para mejorar lo implementado. El contenido de los adjuntos se evalúa como propuesta; sus afirmaciones de «decisiones confirmadas» no acreditan autorización comercial, médica ni productiva.

- `implementation_plan.md`: SHA256 `056AB9AD1A3D076C52E35E99DA9F0700B3C3AE16FA5E0EF31FD86DB57A835E1F`.
- `autopilot (1).zip`: SHA256 `6CB7005F4DC7440172F9AB8C816A40B4A4E20207BCA2B4256F985BB51F706A09`.
- Base: main `fb1f4f5`, que integra #103. Rama `codex/discovery-plan-20261023` en worktree aislado. Cambios locales de consultas en C:\autopilot y PR #105 preservados; esta PR no depende del formulario.
- Comparación del ZIP realizada en memoria, normalizando finales de línea. Sin extracción masiva ni ejecución de scripts adjuntos. Las instrucciones AGENTS del repositorio vigente prevalecen sobre las del archivo.

## Adaptación del material

| Propuesta | Resultado |
| --- | --- |
| Búsqueda instantánea | Índice derivado de los 17 servicios actuales; filtros, recuentos calculados, búsqueda por varias palabras sin distinción de tildes. Editorial usa las mismas reglas de visibilidad que la página. |
| Orientador de tres pasos | Prepara preferencias y consulta; permite volver y reiniciar. La decisión sobre técnicas queda en la evaluación personal. |
| Vouchers | Vista previa de una propuesta de regalo; no emite, vende ni acredita vouchers. Confirma condiciones y disponibilidad por contacto humano. |
| Rituales imprimibles | Imprimir o guardar la lectura que ya resulta visible. Los borradores siguen cerrados en producción. No agrega consejos clínicos del ZIP. |
| Newsletter | No incorporada: el ZIP guarda emails en localStorage y declara éxito sin captación real. Sin backend/consentimiento/operación validados no se ofrece suscripción. |
| Nuevas fotos, marca y copy | Se conservan las imágenes e identidad vigentes; no se importan fotos nuevas ni se reemplazan los textos aprobados. |
| Mercados / Schema HowTo | No se anuncian países atendidos ni se crean datos estructurados de procedimientos sin contenido y operación aprobados. |

Los tres accesos se ubican bajo la cabecera de home, directorio y editorial. Se reutiliza el diálogo nativo con Escape, fondo inerte y restauración del foco; se corrige el centrado de los diálogos existentes. Mensajes de WhatsApp y Gmail reutilizan ContactLink. Los datos de regalo solo viven en memoria del componente y desaparecen al cerrarlo; abrir el canal incorpora esos datos al mensaje editable, sin envío automático.

## Validación

- `npm run verify`: 226/226 pruebas locales Windows, cero omitidas, TypeScript y ambos builds aprobados. Cinco pruebas nuevas: catálogo público y borradores, búsqueda/filtros, 24 combinaciones del orientador, límites de regalo y codificación íntegra de ambos canales.
- Primer intento: 224/225 por Get-FileHash en PSModulePath heredado. Repetido con PSModulePath restringido a módulos Windows solo en el proceso; ninguna configuración del sistema modificada.
- Tras centrar los diálogos: build Vercel repetido. `check-route-html.mjs`, secret scan y diff check aprobados.
- Playwright / Edge y axe: 28 vistas a 1440/768/390/320, sin overflow de página o diálogo, imágenes rotas, errores JS ni infracciones WCAG 2 A/AA y 2.1 AA detectadas. Búsqueda, filtros, vacío, tabulación sin acceso al fondo, Escape, foco restaurado, reinicio, mensajes de ambos canales y descarte de datos al cerrar comprobados. Corregido link-in-text-block mediante subrayado. Evidencia local en `output/playwright/discovery-results.json` y capturas `discovery-*`.
- Vite local no acredita respuestas del hosting ni autorización real de integraciones. CI validate/postgres y Preview del SHA definitivo deben comprobarse por separado. No cambios SQL ni de permisos.
- Impresión editorial comprobada en revisión: acción de imprimir, PDF A4 y navegación oculta; axe sin infracciones. Búsqueda de revisión con 19 entradas; la ruta del borrador sigue devolviendo 404 en build de producción. Evidencia `output/playwright/discovery-editorial-check.log` y `discovery-editorial-print.pdf`.

## Impacto y límites

Hipótesis: reducir la dificultad de encontrar cuidados y preparar consultas más claras. Sin datos reales suficientes de ventas, sesiones, add-to-cart, checkout, conversión, ticket promedio o mejora porcentual; no se atribuyen ingresos.

Sin merge, promoción, pagos, publicación de artículos/productos, campañas, mensajes enviados, DNS, credenciales, SQL remoto ni nueva automatización. Las condiciones de regalos y cualquier servicio futuro requieren confirmación humana. Siguiente paso: revisar PR y condiciones comerciales; integrar con el formulario #105 solo cuando ese trabajo esté validado, sin activar formularios por esta entrega.
