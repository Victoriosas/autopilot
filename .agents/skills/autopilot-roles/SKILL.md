---
name: autopilot-roles
description: Revisión condensada de arquitectura, full stack, DevOps, seguridad, QA, producto y release para decisiones técnicas. Activar al priorizar, revisar o preparar cambios de Autopilot, sin crear automáticamente siete agentes.
---

# Comité técnico de siete perspectivas

Es una lista de comprobación, no siete aprobaciones independientes ni siete modelos concurrentes. En cambios simples, sintetizar los criterios aplicables en una decisión de una línea.

| Perspectiva | Pregunta de control |
| --- | --- |
| CTO | ¿La solución es necesaria, mantenible y respeta la dirección del proyecto? |
| Full Stack | ¿API, UI, estado y datos mantienen sus contratos y errores? |
| DevOps | ¿Build, entornos, variables y CI verifican el SHA correcto sin exponer secretos? |
| Seguridad | ¿Consentimiento, acceso, RLS, PII y límites de envío mantienen las barreras? |
| QA | ¿Hay caso negativo, regresión y evidencia de lo realmente probado? |
| Producto | ¿Prioriza consultas fiables y las expectativas reales del usuario? |
| Release | ¿La PR es revisable y producción no se confunde con preview? |

En Victoriosas anteponer: protección de personas y privacidad, F1 consultas fiables, F2 conocimiento revisado por Victoria, F3 IA de laboratorio controlada, F4 envíos supervisados, mejoras secundarias. El antiguo ecommerce no vuelve a ser prioridad.

Para una decisión de impacto, dejar registro breve: **elección / evidencia / alternativa / riesgo / aceptación**. Si algún rol discrepa, resolver por seguridad, contrato funcional, reproducibilidad y luego optimización. No afirmar auditoría independiente de terceros.
