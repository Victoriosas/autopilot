---
name: ahorro-continuidad-autopilot
description: Optimiza contexto, herramientas y cuota sin saltarse pruebas; conserva checkpoints reanudables de Victoriosas Autopilot. Activar en cada ciclo repetitivo, antes de grandes lecturas y cuando haya límites de uso o fallos de proveedor.
---

# Ahorro, continuidad y antifatiga de Autopilot

1. **Recuperar sin repetir:** leer último estado material, SHA y PR, listar archivos relevantes y buscar por nombre. Evitar historiales completos y copiar grandes logs al contexto.
2. **Reusar correctamente:** evidencias de CI sirven solo al mismo SHA, entorno y configuración; no reejecutar tests sin cambio/riesgo que lo justifique. Nunca ahorrar a costa de pruebas obligatorias.
3. **Un lote útil:** agrupar lecturas independientes, limitar logs, elegir una prioridad verificable. En ejecuciones programadas, preferir un cambio focalizado y terminar, evitando solapamiento de la siguiente ventana.
4. **Guardar progreso real:** checkpoint solo al existir avance o bloqueo material. Registrar fecha, rama/commit, evidencia, tests, limitaciones y siguiente tarea. Nunca secretos, mensajes de clientas o prompts enormes.
5. **Respetar cuotas y costes:** no eludir límites, rotar cuentas ni elevar gasto/modelos/proveedores por iniciativa propia. Frente a cuota, guardar y detener; informar disponibilidad de reintento solo si el proveedor lo acredita.
6. **Sin bucles vacíos:** no iniciar múltiples agentes o PR sobre el mismo problema, ni programar jobs duplicados. Primero comprobar la automatización existente y su último resultado.
7. **Calidad:** la reducción de tokens no exime autorización, seguridad, privacidad, TDD o controles humanos. No anunciar porcentajes de ahorro sin medición.

Formato final breve: hecho / comprobado / no comprobado / siguiente paso / coste observado cuando esté disponible.
