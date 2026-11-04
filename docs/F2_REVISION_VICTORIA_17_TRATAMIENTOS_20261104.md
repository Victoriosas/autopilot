# F2 | Hoja de revisión de conocimiento profesional para Victoria
**Estado: PREPARADO PARA REVISIÓN, NINGUNA FICHA APROBADA.** Fecha: 2026-11-04.

## Fuente y separación
La fuente de nombres es `src/components/public/serviceDirectory.ts`: **11 faciales + 6 corporales = 17 servicios actuales**. La base productiva contiene **21** registros de `public.beauty_services`: los 17 más **4 borradores históricos** preservados, todos en estado `draft`, sin `available=true` en esa tabla. No confundir la tabla histórica de administración con el directorio público del formulario. La tabla privada `private.consultation_service_knowledge` existe con **0** fichas cargadas.

No copiar directamente datos antiguos, duraciones, tarifas ni equipos desde un tratamiento similar. No inferir indicaciones, contraindicaciones o efectos clínicos de su nombre. **Solo Victoria** valida información profesional; el propietario controla su uso por IA, web y canales.

## Inventario canónico de revisión
| Categoría | Tratamiento público | Slug exacto | Estado |
|---|---|---|---|
| Facial | Higiene y limpieza facial | `higiene-y-limpieza-facial` | Pendiente |
| Facial | Limpieza profunda | `limpieza-profunda` | Pendiente |
| Facial | Tratamiento para manchas | `tratamiento-para-manchas` | Pendiente |
| Facial | Acné | `acne` | Pendiente |
| Facial | Rejuvenecimiento | `rejuvenecimiento` | Pendiente |
| Facial | Hidratación y nutrición profunda | `hidratacion-y-nutricion-profunda` | Pendiente |
| Facial | Efecto lifting | `efecto-lifting` | Pendiente |
| Facial | Peeling | `peeling` | Pendiente |
| Facial | Hidratación de labios | `hidratacion-de-labios` | Pendiente |
| Facial | Contorno de ojos | `contorno-de-ojos` | Pendiente |
| Facial | Líneas de expresión | `lineas-de-expresion` | Pendiente |
| Corporal | Exfoliación e hidratación | `exfoliacion-e-hidratacion` | Pendiente |
| Corporal | Masaje modelador | `masaje-modelador` | Pendiente |
| Corporal | Masaje de drenaje linfático | `masaje-de-drenaje-linfatico` | Pendiente |
| Corporal | Masaje descontracturante | `masaje-descontracturante` | Pendiente |
| Corporal | Masaje relax | `masaje-relax` | Pendiente |
| Corporal | Reducción de estrías | `reduccion-de-estrias` | Pendiente |

## Plantilla por tratamiento, exclusivamente en el panel privado
La interfaz del panel privado en **/admin → Fichas → Fichas privadas para Victoria** permite cargar los 17 servicios. El laboratorio sintético queda en esa misma pestaña, en una sección independiente. Para cada tratamiento registrar, si está confirmado:

1. **Descripción para IA** (`description`): alcance real del servicio, sin prometer resultados, diagnóstico ni tratar datos de una clienta.
2. **Técnicas** (`techniques`): solo procedimientos/equipos realmente disponibles y revisados, con indicación explícita cuando la selección depende de evaluación.
3. **Duración confirmada** (`duration`): sin inventar cantidad de sesiones, tiempos o turnos.
4. **Condiciones** (`conditions`): límites y motivos para derivar a valoración profesional; no dar instrucciones terapéuticas ni recomendaciones individuales automáticas.
5. **Preguntas frecuentes** (`faq`): dudas generales verificables; no precio, cupos ni promesas sin evidencia.
6. **Tarifa interna** (`internalFee`): campo estrictamente privado. Nunca publicar ni usar para respuestas automáticas.
7. **Vigencia** (`validUntil`): plazo si se define; no mantener hechos vencidos.
8. **Control de aprobación:** `approvedForAI=false` hasta que Victoria revise expresamente la descripción. `priceApproved=false` hasta aprobación separada de la tarifa. Guardar genera una versión nueva; no saltear concurrencia/conflicto de versión.

**Para el primer guardado:** elegir la ficha, completar solo datos confirmados, dejar ambos controles de aprobación desactivados si falta revisión y guardar desde la sesión `admin` autorizada. La aprobación de IA no publica la ficha en la web ni habilita campañas o mensajes autónomos. Las notas internas de técnicas/duración/tarifas no se exponen como evidencia pública de IA en la versión actual.

## Puerta de salida F2
- [ ] Las 17 fichas tienen versiones documentadas, profesional responsable y vigencia comprobada.
- [ ] Victoria aprobó expresamente las descripciones que puedan utilizarse como evidencia de IA.
- [ ] Prueba de permisos/RLS, ausencia de filtración de tarifa y descripciones caducadas.
- [ ] Casos de laboratorio con fuentes de versión exacta y guardián: 40 casos congelados + 6 negativos, sin llamadas remotas ni gasto hasta acreditar costo.
- [ ] El sistema mantiene bloqueo sobre diagnósticos, precios públicos y resultados garantizados.

**No insertar fichas inventadas en producción ni marcar esta lista como aprobada al crear el documento.**

## Panel F2 de revisión profesional · 04/11/2026 (nuevo flujo de interfaz)

- Acceso previsto: `/admin` → pestaña **Fichas**, separada de **Consultas** (mensajes de clientes) y **Servicios** (catálogo administrativo histórico). El editor profesional aparece primero; el laboratorio de IA queda en un desplegable secundario, sin enviar mensajes.
- Pulsar **Cargar los 17 tratamientos**: el panel consulta las fichas privadas del usuario autenticado y muestra conteos de **sin ficha, borradores, descripciones aprobadas para IA y vencidas**. Los conteos se calculan desde registros guardados, no desde cambios sin guardar. Los cuatro registros históricos de `beauty_services` no se incluyen.
- Seleccionar un tratamiento en la lista. Un borrador **no** cuenta como aprobado; una aprobación vencida tampoco. La tarifa interna tiene un indicador separado de aprobación, sin revelar importe en el resumen.
- Editar descripción, técnicas, duración, condiciones, preguntas frecuentes, tarifa o vigencia marca el formulario como **pendiente de guardar** e invalida ambos controles de aprobación hasta nueva revisión. No se puede marcar aprobación IA sin descripción ni tarifa aprobada sin importe escrito. Cambiar de tratamiento o recargar con cambios sin guardar requiere confirmación para no perder trabajo.
- **Guardar versión privada** conserva selección, actualiza la ficha desde el servidor y vuelve a calcular los totales. Si hay conflicto de versión, se conserva el texto local y se avisa antes de recargar. No se publica contenido ni se envía correo mediante este flujo.
- Prueba: TypeScript OK; tests de resumen de 17 servicios y aprobación independiente OK; Chrome local de pruebas con Vite y API simulada: 17 sin ficha → 16 sin ficha + 1 borrador + 0 aprobados; cancelación de cambio sin guardar preserva contenido, un único POST de simulación, sin correos/IA externa. Script `scripts/test-f2-review-browser.ts` necesita Playwright externo y Chrome local (no forma parte de `npm run verify`).
- **Estado productivo al crear este cambio:** 0 fichas privadas aprobadas. Ninguna aprobación de Victoria ni contenido profesional se infiere de la prueba. El experimento usa datos inventados solo en memoria local y no escribe en Supabase alojado.
