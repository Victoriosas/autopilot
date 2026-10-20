# Política de seguridad de Victoriosas

Este repositorio contiene el código de una tienda y un sitio profesional, con integraciones de terceros. **No publiques vulnerabilidades, credenciales, datos personales ni capturas de información privada en issues, PRs o discusiones públicas.**

## Reportes
Utiliza la pestaña **Security** de GitHub para reportar vulnerabilidades de forma privada cuando esté disponible. Si no hay canal privado habilitado, solicita al propietario que habilite *Private vulnerability reporting* antes de enviar detalles sensibles. Nunca pegues secretos en mensajes públicos.

## Reglas de contribución
- No subir `.env.local`, claves de proveedores, tokens OAuth ni datos de clientes.
- Mantener protección de permisos, validación del servidor, idempotencia, y trazabilidad de cambios críticos.
- Checkout y pagos reales permanecen cerrados hasta validación expresamente autorizada.
- No ejecutar SQL remoto, restablecer bases de datos o desplegar sin autorización.
- Usar dependencias mantenidas y revisar cambios de CI y workflows con especial cuidado.

Esta política no garantiza una auditoría de seguridad y no establece un SLA de respuesta.
