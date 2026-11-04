---
name: victoriosas-conocimiento-tratamientos
description: Preparar la base de conocimiento de tratamientos de Victoriosas en Supabase, sincronizar el catálogo público y controlar aprobación de información y precios para la IA. Usar al editar fichas o respuestas sobre servicios.
---

# Base de conocimiento aprobada por Victoria

## Fuentes
- Consultar `src/components/public/serviceDirectory.ts` para los servicios visibles y la tabla `public.beauty_services` para las fichas administrativas. Comparar conteos reales: no asumir que un catálogo desplegado equivale a fichas aprobadas.
- `docs/OPENCODE_DIRECTIVES.md` fija identidad y restricciones. Solo usar material aportado o expresamente aprobado por Victoria; la experiencia previa, textos de prueba y prompts no son fuentes comerciales autorizadas.

## Estructura mínima
- Identificador y nombre canónicos, categoría, descripción, técnicas/equipos, duración orientativa, condiciones, preguntas frecuentes, estado, versión, fecha y responsable de aprobación.
- Distinguir de forma explícita: `draft`, `aprobado_para_IA`, `aprobado_para_publicar`, y `precio_autorizado_para_comunicar`. Si el esquema aún no soporta estados separados, PROPONER cambios aditivos y probar migración local; no aplicar DDL remoto por iniciativa propia.
- Los valores de `proposed_price_uyu` y `price_approved` existentes no implican exposición pública ni permiso automático para responder una tarifa concreta.
- Al recuperar evidencia, exigir fuente, versión, vigencia, aprobación, servicio y fragmento exacto. No mezclar datos entre clientas ni reutilizar hechos de una consulta como políticas generales.

## Límites de contenido
- Servicios faciales y corporales, evaluación inicial remota y coordinación humana. Sin agenda pública, atención a domicilio, pagos ni precios públicos.
- Equipos mencionados en documentación vigente: punta de diamante, radiofrecuencia, electroporación facial, dermapen. No reincorporar mesoterapia.
- No inventar duración, sesiones, resultados, disponibilidad, ubicación, indicaciones, contraindicaciones ni tarifas.
- Pregunta sin dato aprobado: redactar que Victoria lo confirmará personalmente, sin prometer fecha ni contacto no ejecutado.

## Entrega
- Matriz servicio → información existente → información faltante → fuente → aprobación pendiente.
- Fixtures sintéticos y pruebas que demuestren que datos sin aprobar o vencidos NO llegan al Redactor.
- Revisar RLS y acceso; cambios a fichas productivas o publicaciones solo tras aprobación específica.
