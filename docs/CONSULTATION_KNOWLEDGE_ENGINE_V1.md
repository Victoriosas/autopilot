# Biblioteca inteligente de consultas · Ciclo A

Estado: biblioteca local de laboratorio; sin integración operativa ni envíos. Base GitHub `main` contrastada: `1c44a6389a7bbd6ac9157ac087269e216e654373`. PR #122 conserva su política de precio y #124 su propuesta de catálogo/agentes; esta biblioteca no activa ni incorpora esas ramas. PR #220–224 y ORD-204G quedan intactas.

## Entrega funcional

- 20 intenciones FAQ-001…020, con identificador semántico, 10 preguntas sintéticas por intención, fuentes requeridas, política de hechos aprobados, versión, vigencia y campos de responsable/fecha de revisión. Todas las entradas siguen en borrador, sin aprobación profesional. Su historial se conserva en Git; no son nuevas fichas de tratamiento ni otra tabla de conocimiento.
- 200 preguntas base, 20 casos de contraste (coloquial, faltas, varias intenciones) y 8 negativos explícitos (inyección, privacidad, salud, menores, servicio ausente y ambigüedad). Los ejemplos se utilizan para evaluación, nunca como evidencia o valores comerciales. Se conservan sin cambios los corpus congelados y agentes existentes.
- `classifyConsultationFAQ(input)` amplía la taxonomía administrativa; reutiliza `understandConsultation` para riesgos y candidatos de servicio, y el catálogo canónico de 17 servicios. Devuelve intención principal/secundarias, servicio, datos faltantes, riesgos y revisión obligatoria. Las coincidencias son reglas acotadas, no probabilidades ni prueba de comprensión general.
- `prepareConsultationFAQ(input, {facts, now})` recupera fragmentos exactos y referencias con versión, responsable, revisión y vigencia mediante `currentFacts` y `unsafeConsultationFact` existentes. Los nombres del catálogo proceden del directorio publicado. Para descripciones, nunca mezcla servicios.
- `prepareConsultationFAQFromStore(input, serviceKnowledgeStore)` es el punto de integración con el RPC aprobado existente. No añade tablas, red, credenciales o permisos. Si falla la fuente, devuelve `knowledgeAvailable=false` sin sustituir fichas privadas por descripciones publicadas. El catálogo publicado puede seguir identificado como fuente pública independiente.
- Las revisiones se eligen antes de filtrar aprobación/vigencia. Una versión más reciente retirada, vencida, inválida o de fuente no autorizada no reactiva una aprobación antigua. Empates contradictorios y metadatos inválidos cierran la recuperación.

## Contrato y límites de seguridad

Cada resultado conserva intención, evidencia/catálogo, estado y texto seguro para pedir aclaración o revisión. Los fragmentos recuperados no son una respuesta validada por el Guardián. `decision.action` siempre es `no_send` y `requiresHumanReview` siempre es verdadero. No acepta capacidades de envío ni proveedores de modelos; no persiste mensajes. No incorpora nombres, teléfonos o texto arbitrario de la consulta en los textos de respuesta.

Los precios, promociones, horarios, dirección exacta, pagos y agenda no cuentan hoy con una proyección autorizada en este adaptador: se abstiene y pide aclaración/revisión. Tampoco concede permiso para comunicar importes por encontrar una cifra en un fragmento. El campo `priceApproved` de fichas internas no se convierte en autorización pública. Los casos clínicos, menores, promesas, privacidad e inyección quedan sin evidencia para composición automática.

Se reutilizan exclusivamente fuentes del módulo publicado y del RPC de conocimiento existente. El parámetro `facts` es una dependencia de confianza del servidor/pruebas, no un campo admitido de modelos o consultas públicas. La biblioteca no certifica la veracidad de una fuente que un caller privilegiado falsifique deliberadamente.

## Ejecución reproducible

Con Node 24, desde la raíz del checkout y tras `npm ci`:

```bash
node --import tsx scripts/eval-consultation-faq.ts
node --import tsx --test src/storefront/consultationFAQ.test.ts
npm run verify
node scripts/secret-scan.mjs
```

El evaluador emite conteos, IDs de fallos y exit distinto de cero si falla una expectativa. No imprime mensajes ni hechos privados. Los resultados sobre 228 casos escritos a mano no son una medida de exactitud en tráfico real. Las pruebas específicas comprueban recuperación exacta, revocación, expiración, conflicto, desconocidos, inyección, consentimiento y error de fuente, además de clasificación.

Resultado local final: evaluador 228/228 casos sin fallos; 10/10 pruebas focales; `npm run verify` exit 0, 475 pruebas: 474 aprobadas, una omitida y cero fallos; tipos, 13 skills, ambos builds y comprobaciones de API compiladas aprobados. Escaneo de secretos y `git diff --check` aprobados.

La validación local se ejecuta en Linux cloud, no en el PC Windows. En este contenedor se usa el subreaper externo `/workspace/cloud-setup/reap.py npm run verify` invocado con Python para la prueba existente de procesos descendientes; no modifica ni omite tests. La CI verifica por separado el SHA final. No hay cambios de persistencia que requieran migración o un nuevo ensayo alojado.

## Integración lista y siguiente ciclo

Ciclo B puede consumir `classification`, `results[].evidence` y sus versiones para construir variantes de borrador; debe conservar el contrato estructurado y pasar por el Guardián independiente existente antes de revisión humana. Los 200 ejemplos y los 28 controles adicionales quedan disponibles como regresiones de esa integración. Ampliar gramática con ejemplos nuevos justificados y mantener controles fuera de las reglas.

Todavía no están implementados: generación abierta con modelo, variación por historial/idioma/canal, paquetes informativos, registro de solicitudes, interfaz de revisión de FAQs ni integración en bandeja (C/D). Una solicitud no habilita ningún canal. No se ha probado ni usado un modelo remoto. Ninguna aprobación clínica/comercial o envío real se crea en este ciclo.

Rollback: revertir la PR. Sin cambios remotos, migraciones, modelos ni servicios que revertir. El deployment Git queda deshabilitado únicamente para la rama de esta propuesta en `vercel.json`.
