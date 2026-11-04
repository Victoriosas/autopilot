---
name: victoriosas-codex-ahorro-tokens
description: Organizar cambios de Codex en Victoriosas con lectura selectiva, pruebas focalizadas, mínimo contexto y progreso resumido. Usar en desarrollo largo, bugs repetidos, auditorías costosas o cuando se pida ahorrar tokens; no para saltar validaciones.
---

# Desarrollo eficiente sin pérdida de calidad

## Estrategia
1. Formular en dos frases: síntoma verificable, resultado comprobable. Elegir UNA tarea prioritaria con archivos y pruebas acotados.
2. Leer `AGENTS.md`, `docs/OPENCODE_CHECKPOINT.md` y estado Git. Consultar documentación histórica SOLO si hace falta para el cambio; los documentos fechados no prueban el estado actual.
3. Buscar por ruta, símbolo o patrón; leer rangos pequeños. No volcar todo `docs/AUTOPILOT_STATE.md`, logs extensos, `node_modules` ni salidas repetidas.
4. Reutilizar habilidades especializadas cuando correspondan. Elegir UNA principal; invocar otras solo ante dependencias verificadas. Evitar subagentes paralelos que revisan lo mismo.
5. Formular hipótesis → prueba RED focalizada → cambio mínimo → prueba GREEN → `npm run verify` antes de PR. Inspeccionar logs solo cuando fallen.
6. Evitar despliegues por iteración. Usar rama propia, commits pequeños y PR revisable; nunca auto-fusionar.
7. Registrar contexto necesario (SHA, archivos, prueba, resultado, siguiente acción) en un resumen de máximo 350 palabras. Actualizar el checkpoint corto sin copiar toda la sesión.
8. Informe por fase de hasta 180 palabras: hecho, prueba, bloqueo, próximo paso. Los límites no justifican ocultar riesgos ni falsificar éxito.

## Presupuesto y modelos
- Usar razonamiento moderado para cambios acotados y alto solo cuando una incertidumbre técnica lo justifique; respetar modelos realmente disponibles en el entorno de Codex.
- Ninguna instrucción de ahorro habilita modelos de pago o cuotas extra sin autorización. Medir consumo si el entorno lo expone; no prometer un porcentaje de ahorro.
- Cuando falta acceso a un conector, continuar con mocks o pruebas locales y marcar la verificación remota como NO VERIFICADA.

## Criterio de salida
PR pequeño, pruebas pertinentes y límites declarados. Una explicación corta con evidencia es mejor que muchos intentos sin validación.
