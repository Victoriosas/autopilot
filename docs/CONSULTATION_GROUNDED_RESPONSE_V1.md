# Ciclo B · Composición fundamentada y Guardián

Base verificada: PR #225, `3bb87e4dce42dd74ac32085e2911550806f642ba`. Propuesta apilada en `codex/consultation-grounded-response-v1`, sin fusionar A ni modificar los corpus congelados. Reutiliza las 20 intenciones y 228 casos de A.

## Contrato

`composeGroundedConsultation(input, {facts, now, context})` devuelve un borrador estructurado, no una respuesta autorizada. Tres variantes reproducibles (breve, cordial y explicativa) cambian saludo y disposición; el cuerpo conserva los mismos fragmentos exactos. Las variantes de aclaración/derivación se seleccionan por datos faltantes o riesgos, no por una invención de contenido. Cada cláusula factual lleva ID y versión; la lista de fuentes conserva la procedencia. Los textos administrativos proceden de una política versionada, nunca del mensaje original.

`input` es la consulta normalizada ya existente y contiene el canal preferido. No se incorpora historial personal en prompts ni ejemplos. Un contexto de servidor opcional debe tener autorización y vigencia; queda ligado al hash del borrador. Su retirada o expiración invalida la revisión. Sin contexto, la función se usa como biblioteca de laboratorio local: no otorga permiso de acceso a consultas reales.

`groundedContext` usa `prepareConsultationFAQ`, las fuentes del Ciclo A y el catálogo publicado. Un pedido de faciales restringe el catálogo a esa categoría. No hay precios ni agenda autorizados en esta proyección: requiere confirmación administrativa. Los casos profesionales derivan a evaluación; la política de urgencia reutiliza la existente, sin diagnosticar.

Una solicitud de material por correo/WhatsApp produce `information_request` estructurado en memoria: canal, revisión pendiente, permiso de contacto externo falso y `no_send`. Puede reunir el catálogo público aprobado; no escribe una solicitud durable ni certifica consentimiento para contactar. La persistencia/gestión de solicitudes queda para C y la integración en bandeja para D.

## Guardián independiente

`reviewGroundedConsultation(input, candidate, options)` vuelve a obtener el contexto y evidencia con las dependencias del servidor. No llama al compositor ni acepta su aprobación. Comprueba esquema, límites, hash de contexto/canal, fuentes y versiones, vigencia, datos faltantes, cláusulas exactas, texto renderizado y ausencia de datos de contacto en la evidencia de orientación.

Además adapta el borrador al contrato de agentes existente y ejecuta `checkDraft` de `consultationAgentEval.ts`: esquema de producción, referencias, preguntas cubiertas y controles deterministas de contenido/compromisos. No se activa la llamada remota de camelRun. Este es el recorrido local determinista del Guardián, no una evaluación por un modelo independiente.

Estados: `approved_for_human_review` (apto solo para revisión), `requires_information` (aclaración/confirmación pendiente) o `blocked`. Todos devuelven `no_send`. Un candidato que cambia el permiso, elimina revisión, se autoaprueba, altera fuentes o añade texto se bloquea. Las fuentes de revisión son una dependencia de confianza del servidor, no un campo proporcionado por el usuario o por un futuro modelo.

## Laboratorio reproducible

Node 24, desde la raíz del checkout tras `npm ci`:

```bash
node --import tsx scripts/demo-consultation-grounded.ts --synthetic
node --import tsx scripts/demo-consultation-grounded.ts --synthetic --question '¿Cuánto sale una sesión?'
node --import tsx scripts/eval-consultation-faq.ts --grounded
node --import tsx --test src/storefront/consultationGrounded.test.ts
npm run verify
node scripts/secret-scan.mjs
```

El opt-in `--synthetic` es obligatorio. No introducir datos personales. La demo imprime tres textos, trazabilidad, faltantes y decisión del Guardián; no imprime la pregunta original ni contactos. La evaluación ampliada verifica los 228 casos y falla ante errores inesperados de composición/contrato, además de las expectativas de A.

Ejemplo ejecutado de precio sin servicio:

> Hola.\nNo dispongo de un precio aprobado para comunicar. Se necesita confirmar el importe actualizado con Victoria.\n¿Sobre cuál de nuestros servicios te gustaría consultar?\nLa propuesta queda pendiente de revisión de Victoria.

Resultado: cero fuentes de importe, revisión `requires_information`, `no_send`. El catálogo facial de la demo devuelve 11 fuentes de `src/components/public/serviceDirectory.ts`, versión `2026-10-23-v1`; revisión apta para revisión humana. No afirma tarifas, agenda o entrega.

## Validación, límites y siguiente integración

Pruebas focales: reproducibilidad, los 228 casos, múltiples intenciones, falta de evidencia, versiones cambiadas/retiradas/vencidas y conflictivas, manipulación de permisos/texto, privacidad, contexto expirado y destinatario cambiado. Resultado local: 9/9 focales; evaluador 228/228 sin fallos; `npm run verify` exit 0, 484 pruebas (483 aprobadas y una omitida específica de Windows), tipos/13 skills/builds/API compiladas aprobados. Escaneo de secretos y diff aprobados. CI se registra en la PR por SHA.

No hay interfaz nueva, persistencia, migración, envío, modelo remoto o ejecución de ORD-204G. El modo local no sustituye autorización administrativa, retención de expedientes ni consentimiento específico al integrar con datos reales. La protección de fidelidad es intencionadamente estricta: un futuro modelo no podrá añadir prosa libre sin ampliar y validar el contrato del Guardián.

Siguiente paso: consumir borrador + revisión en el flujo supervisado existente, conservar fuentes/huella y distinguir aptitud de contenido de autorización de envío. Antes de enviar desde una interfaz se requiere nueva revisión humana y las guardas de entrega existentes; los estados de este módulo nunca habilitan por sí solos un envío. Rollback: revertir la PR; no hay cambios alojados. Deployment Git deshabilitado solo para esta rama.
