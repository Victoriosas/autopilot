# Privacidad de solicitudes Beauty

Contrato `beauty-v1`, en preparación para revisión. No es una afirmación de cumplimiento legal certificado.

- Se registra exclusivamente nombre, apellido, contacto, zona aproximada, servicio, preferencia horaria, origen de campaña permitido y consentimiento de atención.
- No se aceptan campos de piel, sensibilidad, antecedentes, objetivos médicos, documentos, imágenes o dirección exacta en la API inicial. La información profesional posterior requiere un módulo separado y reglas aprobadas.
- El registro requiere revisar y confirmar una segunda acción; WhatsApp recibe solo texto genérico y UUID opaco. El UUID no habilita consulta pública de datos. Abrir WhatsApp no demuestra envío ni reserva.
- La API no registra cuerpos ni datos personales en logs. POST de más de 4 KB, campos extra, contacto inválido y ausencia de consentimiento se rechazan. No se habilitan campañas con ese consentimiento.
- RLS y grants: anónimo sin acceso; cliente autenticado sin lectura de otras solicitudes ni escritura directa; administrador validado con Auth y `profiles.role` puede leer/revisar; servidor inserta con service role, nunca expuesta al navegador. Las políticas existentes de profiles también deben estar auditadas en el esquema alojado.
- Estados: pending → reviewing → confirmed → completed; cancelación desde estados activos. `confirmed` requiere acuerdo manual; no es integración de calendario ni envía mensajes.
- Acceso administrativo caduca tras 90 días. La función de borrado de vencidas está preparada y probada solo localmente; su instalación/operación alojada y la gestión de retiro están pendientes: NO recoger solicitudes reales hasta completar ese procedimiento, responsable y revisión de obligaciones uruguayas. No se elimina ningún dato alojado en esta tarea.
- El límite transaccional de tres solicitudes por contacto/hora ayuda contra duplicación; no sustituye protección perimetral frente a abuso distribuido. UUID más fingerprint evita duplicados en reintentos idénticos y rechaza cambios bajo la misma referencia.
- Solicitud de retiro: contactar a Sofía por WhatsApp indicando la referencia, verificar identidad fuera de enlaces públicos y tramitar mediante un procedimiento administrativo autorizado. No existe aún un endpoint público de borrado.

Antes de habilitar producción: revisar información del responsable, canal de derechos, plazo/causa de retención, mecanismo de borrado y medidas antiabuso. No usar el repositorio, CSV o Google Contacts como base de datos de clientes reales.


## Referencias oficiales para revisión del responsable

La URCDP describe obligaciones de consentimiento, seguridad e inscripción de bases usadas fuera del ámbito doméstico: https://www.gub.uy/unidad-reguladora-control-datos-personales/politicas-y-gestion/obligaciones . Revisar su aplicación al negocio antes de habilitar la recepción pública.

La guía de salud explica el tratamiento especial de datos sensibles: https://www.gub.uy/unidad-reguladora-control-datos-personales/comunicacion/publicaciones/guia-de-proteccion-de-datos-en-salud . Por minimización, no forman parte de este registro inicial.

Para rectificación/actualización/supresión, la URCDP señala un máximo de cinco días hábiles para procesar o informar motivos de improcedencia: https://www.gub.uy/unidad-reguladora-control-datos-personales/tramites-y-servicios/formularios/formulario-para-ejercer-derechos-rectificacion-actualizacion . El plazo técnico de 90 días no sustituye esos derechos ni es un plazo legal impuesto por este estudio.

Datos todavía necesarios: identificación y contacto definitivo del responsable, revisión del aviso y determinación de trámites aplicables. Ninguna base de clientes se inscribió ni se comunicó a terceros desde esta tarea.
