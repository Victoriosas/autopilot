---
name: victoriosas-camelrun-laboratorio
description: Inspeccionar, evaluar o conectar agentes de comprensión, redacción y guardián en camelRun para Victoriosas, usando solo casos sintéticos, coste controlado y revisión humana. Usar al probar IA; no para envíos autónomos.
---

# Laboratorio de agentes IA

## Inventario antes de ejecutar
1. Respetar `AGENTS.md`. Comprobar definiciones, agentes, modelos, fuentes y registros reales de camelRun mediante herramientas disponibles. No deducir que un agente está trabajando 24/7 porque está definido o cargado.
2. Reutilizar agentes de laboratorio existentes antes de crear otros: `victoriosas-lab-comprension-free`, `victoriosas-lab-redactor-free` y `victoriosas-lab-guardian-free`. No tocar agentes originales en producción salvo instrucción expresa.
3. Revisar disponibilidad, tarifa y límites del modelo en la conexión activa. Un coste cero observado anteriormente NO garantiza gratuidad permanente. No ejecutar modelos pagados ni comprar créditos sin autorización.

## Circuito aislado
- Entrada sintética → Comprensión (JSON válido) → recuperación SOLO de fichas aprobadas → Redactor (borrador sin envío) → Guardián independiente → validación determinista en código → decisión humana.
- El test no requiere herramientas conectadas si la definición del agente no usa herramientas. `loaded=false` significa inactivo en memoria, no necesariamente fallido.
- Nunca enviar al proveedor nombre, teléfono, email, documentos o historia clínica de un cliente; respetar el consentimiento de IA. Probar siempre con datos inventados.
- Exigir salida JSON parseable, esquema correcto, citas de evidencia con id/versión/vigencia, clasificación explícita de riesgos y control por código.
- Un modelo puede omitir riesgos: bloquear por reglas locales precio no aprobado, diagnósticos, aptitud clínica, garantías de resultados, fuga de datos, instrucciones inyectadas y compromisos no ejecutados, aunque el LLM declare APTO.
- Ejecutar primero los casos focalizados y después el corpus congelado del repositorio mediante `npm run eval:consultation-agents` con argumentos confirmados en el script. No modificar los 40 casos ni los controles negativos para fabricar aprobados.
- Emplear request IDs únicos y repetibles en pruebas, límites de reintentos y presupuesto; registrar coste de modelo que el proveedor reporte, no inferirlo.

## Salida
Tabla con caso, agente, JSON válido, hallazgos, estado del Guardián, estado de reglas deterministas, coste verificado y efecto externo (debe ser NINGUNO). Fallos graves impiden activar producción.
