# Contenidos y recorrido de clientas · 29 de octubre de 2026

Estado: implementación en rama; revisión editorial pendiente. Ningún artículo nuevo publicado.

## Alcance real y hallazgos

El navegador público mostró «This deployment is temporarily paused». El propietario confirmó falta de pago. No se atribuye a un error del código ni se acredita un recorrido público completo. No se cambió Vercel ni se realizaron gastos. Esta revisión usa el código de main 27b95a5; no incorpora ni sustituye PR148.

La lectura del código encontró 17 fichas con descripción, objetivos, límites y duración; no faltaban todas las descripciones. El espacio editorial tenía dos borradores breves y ninguna publicación. La portada ya explica la evaluación remota y tiene cinco FAQ: se preservaron. Faltaba desarrollar las dudas específicas y conectarlas con lecturas. La búsqueda literal no encontraba «limpieza de cutis» en servicios; se agregó su equivalencia con facial y una regresión.

## Inventario del recorrido en el código

| Superficie | Función | Cambio y límite |
| --- | --- | --- |
| `/` | Presentación, pasos, FAQ y contacto | Se preservan textos, fotos y estilo; sin nueva inspección visual pública |
| `/nuestros-servicios` | 11 faciales y 6 corporales | 34 FAQ nuevas en revisión y enlaces solo a artículos visibles en cada entorno |
| `/servicios` | Entrada existente de servicios | Conservada; no se crea catálogo paralelo |
| `/de-mi-para-ti` | Índice y categorías | 12 nuevos borradores; 14 contando los dos anteriores; cuatro categorías existentes preservadas |
| `/de-mi-para-ti/:slug` | Lectura | Subtítulos, fuentes, servicios relacionados y consulta contextual; nuevos slugs 404 en producción |
| `/consultanos` | Consulta privada con servicio contextual | Se conserva formulario y consentimiento; no se envían datos en esta misión |
| `/victoria`, `/contacto`, `/privacidad` | Confianza y contacto | Rutas existentes conservadas; no se inventa formación ni dirección |
| Búsqueda | Encontrar servicios y artículos permitidos | «limpieza de cutis» resuelve higiene facial; borradores excluidos en modo público |
| `/admin` y otras rutas internas | Administración | Sin cambios, sin acceso a datos personales |
| `/tienda`, `/checkout`, `/tratamientos` | Rutas retiradas | Barreras existentes preservadas; no se habilita comercio |
| robots y sitemap | Descubrimiento público | No se agregan slugs de borradores ni se cambia indexación |

## Textos completos implementados

En `src/storefront/clientEditorial.ts`, todos `draft` y `date: null`:

1. Limpieza de cutis: qué es y cómo empezar.
2. Higiene facial y limpieza profunda: cómo distinguirlas.
3. Hidratación facial: qué conversar antes de elegir.
4. Piel sensible: cómo preparar tu primera consulta.
5. Manchas: qué puede orientar una consulta estética.
6. Granitos y acné: cómo plantear tu consulta.
7. Peeling: por qué requiere una evaluación individual.
8. Masaje relax y descontracturante: qué preguntar para elegir.
9. Drenaje linfático: preguntas antes de coordinar.
10. Cómo comienza la atención: evaluación inicial remota.
11. Tu primera consulta con Victoria: qué conviene tener a mano.
12. Rutinas y remedios virales: preguntas antes de probarlos.

Cada pieza tiene introducción, cuatro o más secciones, lecturas relacionadas y, donde corresponde, servicios del catálogo y referencias. No se atribuye autoría o revisión a Victoria. Se usa la ilustración abstracta existente, no resultados simulados. Las dos piezas anteriores se conservan.

En `src/components/public/serviceQuestions.ts`: dos preguntas y respuestas distintas para cada una de las 17 fichas y seis FAQ de primera consulta. Se muestran únicamente en el modo editorial de revisión existente. Las fichas publicadas no reciben protocolos nuevos ni cambios de alcance.

## Fuentes y límites

Referencias consultadas el 29/10/2026; enlazadas en los artículos:

| Fuente | Afirmaciones utilizadas | Límite |
| --- | --- | --- |
| AAD · Face washing 101 | Higiene cotidiana y posibilidad de irritación al frotar | No demuestra un protocolo de cabina de Victoriosas |
| AAD · How to pick the right moisturizer for your skin | Formulaciones distintas, natural no equivale a hipoalergénico y consulta por sequedad problemática | No prescribe productos para una persona |
| AAD · Acne: Tips for managing | Riesgos de manipular lesiones | No acredita que una limpieza trate el acné |
| AAD · Chemical peels: Overview | El nombre cubre procedimientos de distinto alcance | No confirma técnicas o habilitaciones de Victoria |
| NCCIH · Massage Therapy: What You Need To Know | Evidencia variable o limitada sobre dolor | No promete curación ni sustituye atención médica |
| NHS · Lymphoedema: Treatment | Drenaje clínico especializado dentro del manejo de linfedema | Página declara revisión de marzo de 2023; no valida tratamiento estético ni autorización profesional local |

Los artículos operativos parten del flujo aprobado y de las fichas actuales. Manchas conserva los límites ya publicados; no se agregan diagnósticos ni eficacia de despigmentantes. La aprobación profesional de todas las piezas sigue pendiente.

## Recorridos previstos y comprobación disponible

| Necesidad | Recorrido implementado | Evidencia y pendiente |
| --- | --- | --- |
| Primera limpieza de cutis | Buscador → servicio → lectura → consulta | Regresión de búsqueda; lectura solo en revisión |
| Elegir limpieza o hidratación | Catálogo → diferencias y FAQ | Enlaces válidos por inventario; revisión visual pendiente |
| Manchas, granitos o sensibilidad | Lecturas con límites → consulta o derivación apropiada | Texto redactado sin autodiagnóstico; revisión profesional pendiente |
| Elegir un masaje | Fichas → comparación y drenaje | Preguntas específicas y fuentes; no confirma indicación individual |
| Conocer a Victoria | Presentación existente → preguntas preparadas | No se inventan credenciales; datos profesionales pendientes de validar |
| Artículo → servicio | Enlaces desde lectura y contacto con título del artículo | Destinos contrastados con catálogo; sin envío real |
| Qué pasa después de consultar | Guía remota y primera consulta | Sin reserva automática ni promesa de tiempo; recepción humana no comprobada |

## Confirmaciones agrupadas para Victoria antes de publicación

- Aprobar tono y alcance de los doce artículos, 34 respuestas de servicios y seis FAQ iniciales.
- Confirmar por servicio pasos incluidos/omitibles, duración y frecuencia cuando se quieran publicar; los datos existentes no se ampliaron.
- Confirmar formación/habilitación y alcance de peeling, dermapen, radiofrecuencia y drenaje; no se asume aplicación por poseer un equipo.
- Confirmar modalidad concreta de evaluación remota, canal de información adicional y comunicación de presupuesto; sin inventar gratuidad, videollamada u horarios.
- Aportar presentación profesional verificable si se desea ampliar «Sobre Victoria»; sin inventar credenciales o experiencia.

La revisión agrupada no bloquea pruebas ni preparación técnica. Publicación solo tras aprobación y fecha real. No se cambiaron pagos, correo, agentes, SQL, DNS ni secretos.

## Validación

Ver el cierre de la PR y la continuidad para resultados finales. No se declara auditoría visual móvil, recepción humana, evaluación IA ni producción verificada. La reactivación por pago queda a cargo del propietario.

Cierre local: `npm run verify` exit0, 356 aprobadas/0 fallidas/1 omitida preexistente de preparación offline; tipos y builds servidor/Vercel correctos. Directorio 3/3 por separado. Render SSR de revisión comprobó 17 bloques FAQ y enlaces/secciones/contacto de la lectura de limpieza. `check-route-html`, `secret-scan` y `git diff --check` aprobados. SSR no acredita comportamiento de navegador, móvil o accesibilidad visual. CI remota pendiente hasta publicar la rama y comprobar el SHA.
