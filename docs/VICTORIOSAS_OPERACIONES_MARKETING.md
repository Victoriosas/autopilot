# Victoriosas: controles y marketing orgánico

Estado: preparación técnica, sin anuncios pagados, automatización de mensajes ni activación de reservas.

## Desarrollo y protección
- GitHub Actions `autopilot-core-v4.yml` es la suite principal; no duplicar validaciones.
- `Victoriosas Public Health` verifica cada día las rutas públicas y la configuración booleana de consultas, sin claves ni acceso a datos privados.
- Revisar failures en Actions. Un HTTP 200 no sustituye revisión visual ni pruebas de permisos.
- Despliegues solo después de CI y validación del commit exacto.
- Worktrees: `diseno`, `beauty`, `comercio`; evitar ediciones simultáneas a los mismos archivos.
- Para instalar hooks locales, primero decidir un contrato común con Codex; no modificar `core.hooksPath` compartido sin coordinar a todos los worktrees.
- No automatizar cambios de producción ni de Supabase por un fallo de disponibilidad.

## Marketing: flujo seguro
1. Revisar servicios reales, zonas y canal de contacto autorizados por Victoria.
2. Planear semanalmente tres publicaciones y una idea de reel para Instagram/Facebook. Dejar en borrador.
3. Revisar cada pieza con Victoria: imagen autorizada, descripción cierta, claims cosméticos, disponibilidad y consentimiento.
4. Publicar manualmente tras aprobación; registrar enlace y fecha.
5. Medir consultas reales por fuente mediante UTM no sensible y referencias; no incluir información de piel o salud en URLs.
6. Campañas de pago solo después de definir presupuesto, creatividades, segmento y aprobación explícita.
7. No inventar testimonios, resultados, certificados ni promociones; no mandar mensajes no solicitados.

## Embudo básico
Visita -> Tratamiento -> Consulta WhatsApp -> Confirmación humana -> Seguimiento autorizado.
Medir clics y consultas, no confundir clic con turno reservado.

## Revisión operativa
Cada lunes: propuesta editorial y mejoras SEO.
Diariamente: salud pública y señal de regresiones.
Antes de deploy: revisar PR, CI, contrastes, navegación móvil, enlaces y seguridad.
