---
name: autopilot-core
description: Orquesta ciclos verificables de inspección, prioridad, ejecución, validación y continuidad en proyectos técnicos. Activar en desarrollo sostenido de Autopilot y cuando se soliciten avances autónomos, sin confundir una sesión con trabajo permanente.
---

# Autopilot Core | Ciclo de trabajo verificable

Aplicar solamente dentro del alcance autorizado y del repositorio identificado. No es un proceso en segundo plano ni suplanta las instrucciones de `AGENTS.md`. En Victoriosas, `victoriosas-desarrollo-autonomo` fija el orden de prioridades; `autopilot-safety` fija los límites.

## Ocho pasos por avance
1. **Inspección:** localizar raíz, instrucciones, estado reciente, Git/HEAD, worktrees, PR y actor concurrente. El estado histórico nunca prueba el actual.
2. **Priorización:** escoger una sola tarea ejecutable y útil. Definir aceptación y qué NO se hará.
3. **Ejecución:** hacer un cambio mínimo, reversible y aislado. Si hay edición humana o agente en el mismo ámbito, no escribir.
4. **Validación:** ejecutar pruebas requeridas y relevantes; asociar cada resultado con su SHA, rama y entorno. Un mock no equivale a producción.
5. **Documentación:** actualizar checkpoint existente solo si cambió algo material, sin información sensible ni duplicados.
6. **Autoevaluación:** contrastar entregable con la aceptación y los riesgos; corregir antes de declarar éxito.
7. **Siguiente paso:** registrar meta, evidencia, archivo o PR pertinente, aceptación y bloqueos para el siguiente ciclo.
8. **Continuación:** en sesión interactiva seguir si queda trabajo autorizado e independiente; en ejecución programada terminar después de un lote significativo, o antes si no hay novedad, para evitar solapamientos.

## Reglas de fiabilidad
- Si falta capacidad, conexión, autorización, cuota o tiempo, guardar resultado y razón verificable. Nunca afirmar que se reanudará solo.
- No relanzar trabajos que siguen ejecutándose ni repetir un mismo error en bucle; hasta tres reintentos transitorios comprobables.
- No abrir PR si ya existe trabajo equivalente. No fusionar, desplegar, migrar, facturar ni contactar a terceros sin autorización específica actual.
- No sobreescribir trabajo ajeno o un `AGENTS.md` existente. Codex es ejecutor principal para Victoriosas; no disparar OpenCode en paralelo.
- En el informe separar `VERIFICADO`, `PREPARADO`, `BLOQUEADO` y `NO COMPROBADO`.

## Cierre
Informar resultado, comando o prueba efectivamente ejecutada, SHA/PR cuando proceda, riesgo pendiente y siguiente tarea. `PROJECT_COMPLETE` exige criterios de aceptación realmente cumplidos; una interrupción o cuota agotada es solo interrupción, no un éxito.
