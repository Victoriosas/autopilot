# Victoriosas Beauty: implementación a partir de Figma (borrador)

Fecha: 2026-10-19. Archivo editable: https://www.figma.com/design/WLKfAr5zEcFJhGWdiPbeNw

## Mandato invariable
NO modificar, reescribir, traducir, corregir, truncar ni sustituir leyendas, lema, textos visibles existentes, biografía, datos de contacto ni textos legales en web o redes. Antes de cualquier cambio leer los strings y capturar snapshots de contenido existente en tests. Las maquetas Figma usan placeholders como indicación para CONSERVAR texto, jamás publicarlos.

No publicar ni desplegar a producción; no activar reservas/pagos/checkout, ni credenciales, DNS, ni gastos. Mantener la sección beauty separada del catálogo comercial existente. Fotografías autorizadas de Sofía y logo «Victoriosas» solo de activos legítimos existentes, nunca sustitutos inventados.

## Fusión visual sobre la web EXISTENTE
- Fuente de verdad: src/components/public/ProfessionalSite.tsx, src/components/public/professional.css, src/components/public/PublicNavigation.tsx, src/components/public/ServiceCatalog.tsx y src/storefront/careCatalog.ts, incluidos cambios locales NO confirmados en codex/service-exploration-20261019. No sobrescribir ni reemplazar estos archivos desde una rama anterior.
- Conservar el diseño actual de Victoriosas: Cormorant Garamond (titulares), tipografía secundaria existente, paleta, fotografías, hero, secciones editoriales, lema, footer, enlaces, CTA y textos literales. El archivo Figma es guía para mejoras complementarias, no una plantilla para sustituir el sitio.
- Incorporar únicamente mejoras compatibles: mejores tarjetas, jerarquía, espaciados, fichas desplegables, navegación y adaptación responsive. Usar las variables CSS existentes; no pegar CSS global de Figma, no reemplazar la página actual.
- Mesoterapia eliminada: no incorporarla en Figma, nuevas fichas, menús, publicaciones ni CTA. No eliminar textos preexistentes del sitio sin revisión de alcance, por la orden explícita de preservar copys.
- Trabajar en la rama local actual solo después de revisar y preservar su estado, o aislar en un worktree con integración consciente. Mantener los archivos locales sin confirmar. Capturar antes/después visual a 390 y 1440 px y contrastar strings.

## Arquitectura de experiencia
- Menú adaptable desktop/mobile: Inicio, Tratamientos faciales, Masajes, Asesoría online, Tienda, Contacto. En caso de alterar menú anterior, conservar las etiquetas existentes y añadir las nuevas sin eliminarlas.
- Página de catálogo: tarjetas accesibles, búsqueda opcional por objetivo (textura, bienestar, firmeza, cuidado diario), filtrado semántico, CTA «Consultar» reutilizando el flujo de contacto/WhatsApp actual, sin exponer información médica en URL.
- Fichas independientes y rutas estables para: punta de diamante, radiofrecuencia facial, electroporación facial, Dermapen y masajes. Usar features flags por servicio: visible informativamente no equivale a reservar.
- Asesoría cosmetológica online: explicar alcance informativo, sin diagnóstico, ficha mínima protegida y consentimiento, seguimiento privado con referencia al flujo Beauty ya implementado. No duplicar endpoints o entidades si existen.
- Diseño cálido y femenino, responsive 360/390/768/1440px, navegación teclado, contraste WCAG AA, imágenes optimizadas y alt auténticos. Inspiración editorial y jerarquía de https://www.skincare.com.uy/medicina-estetica/tratamientos-faciales/ y estructura de navegación de Fresha, sin copiar textos/fotos/código ni marcas.

## Contenido original para propuestas (NO copiar descripciones ajenas)
1. Punta de diamante: microdermoabrasión mecánica superficial para textura y suavidad; cuidados y evaluación de sensibilidad/lesiones.
2. Radiofrecuencia facial: dispositivo de calor controlado; objetivos de apariencia y firmeza con expectativas realistas, contraindicaciones según manual.
3. Electroporación facial: técnica no inyectable de penetración cutánea de ciertos activos compatibles, diferenciándola de los procedimientos inyectables.
4. Dermapen: microneedling invasivo, riesgos de infección e hiperpigmentación; requiere evaluación/habilitación y protocolo de higiene. No habilitar contratación sin comprobarlo.
5. Masajes: bienestar y relajación, tipologías solamente verificadas.
6. Asesoría cosmetológica online: orientación sobre hábitos y cosmética, no consulta médica ni diagnóstico.

## Restricciones clínicas y comerciales
No afirmar «cura», rejuvenecimiento garantizado, resultados permanentes, eliminación total de manchas o cicatrices, cero riesgos, ni beneficios no verificados. No anunciar servicios inyectables ni microneedling sin verificación explícita de habilitaciones locales y alcance profesional. No recomendar protocolos técnicos, parámetros de energía/profundidad o combinaciones invasivas automáticamente. Cada CTA remite a orientación/consulta, no a pago directo.

## Ejecución por Codex / ECC
1. Leer AGENTS.md y docs/AUTOPILOT_STATE.md completos, rama, PRs activos y estado CI. No pisar trabajo en curso.
2. Identificar rutas/componentes actuales de Beauty, contenido literal existente y canales reales de consulta. Añadir pruebas de regresión que detecten cambios en leyendas/textos protegidos. Test de que placeholder Figma no llega al HTML.
3. Implementar catálogo y páginas con datos locales tipados, claves estables, CTA existente, bandera de habilitación por servicio y metadatos SEO no médicos. No tocar checkout.
4. Probar desktop/móvil accesibilidad, enlaces, flujos, seguridad/privacidad, TypeScript y builds; contrastar visualmente con Figma.
5. Abrir PR de implementación en borrador; no fusionar ni desplegar. Registrar evidencia, bloqueos y siguiente paso en docs/AUTOPILOT_STATE.md respetando su formato.
6. Al terminar el lote: determinar la siguiente mejora segura, generar el siguiente prompt y ejecutarlo dentro de la misma sesión si hay permisos, recursos y tiempo, evitando bucles inútiles y sin saltar restricciones.

## Criterios de aceptación
- Diff demuestra cero cambios a textos/leyendas existentes.
- Las páginas nuevas no contienen placeholders ni afirmaciones clínicas no sustentadas.
- Responsive y teclado comprobados en catálogo, ficha y formulario.
- No hay navegación rota ni fuga de datos sensibles a URL/analytics.
- Ningún servicio no verificado queda comprable o reservable automáticamente.
- No se altera el estado deshabilitado de pagos; CI y pruebas completas antes de sugerir merge.
