# Catálogo y evaluación privada — revisión de lanzamiento

Estado: implementación local y de rama; sin autorización de publicación, migraciones alojadas ni recepción de datos reales.

## Catálogo administrable

El panel administrativo permite crear y editar fichas con identificador estable, familia de solicitud, categoría, nombre, descripción, duración, precio propuesto opcional en UYU, aprobación del precio, condiciones, disponibilidad orientativa y estado editorial. La disponibilidad no representa horarios reservables ni integración de Calendar.

Estados: `draft`, `pending`, `approved`, `published`. Las cuatro fichas iniciales son borradores, sin precio y sin disponibilidad. Un administrador puede preparar la aprobación; no se presenta como aprobación obtenida de Sofía. La operadora debe verificarla antes de marcarla. El panel no publica. Para editar una ficha publicada hay que retirarla a borrador y volver a aprobar el precio; las versiones evitan sobrescrituras concurrentes.

La lectura pública exige publicada + disponible + precio aprobado y habilitación de publicación en base. El servidor requiere además `BEAUTY_PUBLICATION_ENABLED=true` para publicar. El control `beauty_publication_control` solo puede cambiarlo el propietario de base; ni el administrador por PostgREST ni service role pueden habilitarlo. Está deshabilitado por defecto. Esto no es una separación de aprobación entre dos personas: la habilitación global necesita autorización humana del alcance y las tarifas requieren revisión comercial.

`GET /api/beauty/catalog` devuelve solo los datos públicos aprobados. Sin habilitación del catálogo devuelve un catálogo deshabilitado para la vista previa histórica. Error, vacío o DTO inválido bloquean el registro y no restauran precios propuestos. La página sigue siendo borrador `noindex`.

La consulta usa el formulario comercial existente y añade `catalogServiceId`; el servidor valida familia, publicación y versión vigente. La base toma una copia de título, duración, precio y condiciones al insertar. El CRM muestra ficha, versión y condiciones históricas. El reintento conserva la referencia y funciona aunque después se retire la ficha. No se registran datos profesionales en el CRM ni en el mensaje de WhatsApp.

## Espacio profesional

Acceso independiente: `/beauty-professional`. Requiere sesión de Supabase verificada y membresía activa en `beauty_practitioners`; ser administradora del CRM no concede acceso. La membresía debe provisionarse por el responsable de base solo después de verificar la identidad y el alcance autorizado; no se provisionó ninguna identidad alojada.

Cada solicitud puede tener una evaluación con información declarada (piel, sensibilidad, reacciones cosméticas, cuidados recientes y expectativas) separada de observaciones y propuesta manual de Sofía (etapas, frecuencia, cuidados posteriores, identificadores de servicios y recomendación de consulta sanitaria). No genera diagnósticos ni decisiones automatizadas.

Antes del primer guardado pide consentimiento expreso y referencia a una constancia escrita. Es una declaración de la operadora, no una firma electrónica ni prueba de haber obtenido consentimiento: el procedimiento y custodia de esa constancia deben aprobarse antes del uso real. Identidad, referencia de solicitud y consentimiento quedan fijos. Primero se guarda borrador; finalizar exige revisión personal, observaciones y una versión existente. La evaluación finalizada es de solo lectura. Rectificaciones y retiro necesitan procedimiento autorizado, no manipulación directa improvisada.

RLS limita lectura/escritura al profesional activo asignado. El CRM, otras profesionales, clientes, anónimos y service role no pueden leer las evaluaciones. No hay exportación, búsqueda general ni envío por redes. Los errores no incluyen contenido; respuestas sin caché; campos limitados y validados. Datos en memoria de la pantalla, sin almacenamiento local. Cerrar limpia la pantalla y el cambio de usuario desmonta el panel.

Caducidad máxima técnica: 90 días y nunca posterior a la solicitud. Borrado de una solicitud vencida mediante el procedimiento de retención preparado elimina su evaluación asociada. El plazo y el procedimiento necesitan aprobación del responsable y revisión de obligaciones aplicables; no se certifica cumplimiento legal.

## Habilitaciones pendientes

`BEAUTY_REQUESTS_ENABLED`, `BEAUTY_CATALOG_ENABLED`, `BEAUTY_PROFESSIONAL_ENABLED` y `BEAUTY_PUBLICATION_ENABLED` permanecen ausentes/false por defecto. La migración nueva es aditiva y no fue aplicada en Supabase alojado. No ejecutar `db push` sobre el historial legado no reconciliado. Se conservan 21 migraciones alojadas fijadas y ahora 27 archivos locales inventariados.

Antes de lanzamiento: respaldo/restauración verificados, revisión de roles y políticas de profiles, identidad profesional, privacidad/consentimiento/retención y canal de derechos aprobados, tarifas/duración/cobertura confirmadas por Sofía y autorización específica del commit y de las tres migraciones Beauty. No hay pagos, agenda automática ni garantía de resultados.

## Próxima instrucción

Conservar la dependencia PR #72 → PR #73 y verificar CI del SHA exacto. Preparar un paquete comercial para que Sofía confirme las cuatro fichas iniciales, sus tarifas, condiciones y consentimiento escrito. Ejecutar únicamente la generación offline del paquete y sus comprobaciones. Dejar todo pendiente de aprobación; no publicar, provisionar acceso alojado, aplicar SQL ni desplegar producción.
