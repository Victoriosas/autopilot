# Triaging PR antiguas | 05/11/2026

**Alcance:** auditoría remota de lectura sobre GitHub; rama base `main=8f1afe45035358b2accbee735c11061fef45652f`. Sin ejecución de tests locales, acceso a datos personales, cambios de servicios ni aprobación de fichas. Esta evidencia debe renovarse si cambia `main`.

## Marco vigente
`AGENTS.md` y `docs/PROJECT_DIRECTION.md` gobiernan. **Codex es el ejecutor técnico principal** (cambio documental propuesto en PR #186, todavía no fusionado al momento de este informe). OpenCode es auxiliar manual. Ruta prioritaria F1 → F2 → F3 → F4, sin saltarse aprobación de Victoria o envío supervisado.

## Comparación de PR abiertas contra archivos de main

| PR | Evidencia comprobada | Disposición recomendada |
| --- | --- | --- |
| [#129](https://github.com/Victoriosas/autopilot/pull/129) Evaluador | Los blobs de `src/storefront/consultationAgentPrompts.ts` y `docs/consultation-agents/eval-cases-v1.json` **coinciden exactamente** entre el head de la PR y main. `scripts/eval-consultation-agents.ts` es diferente. | No fusionar en bloque. Comparar script, pruebas y workflow, rescatar solo regresiones pendientes. Preservar corpus congelado. |
| [#131](https://github.com/Victoriosas/autopilot/pull/131) Gateway | `consultationModelGateway.ts` y su prueba existen en main pero **difieren** del head de la PR. El parche original añadía gateway server-only con flag apagado. | Revisar contratos, controles SSRF, modelo, proveedores y pruebas actuales antes de decidir cierre o adaptación. No habilitar modelos remotos. |
| [#124](https://github.com/Victoriosas/autopilot/pull/124) Catálogo/agentes | La PR añade al directorio `Asesoría cosmetológica online` y `Ritual facial y masaje`; difiere del catálogo canónico de 17. `consultationOperationsAgents.ts` y `consultationAnswerOptions.ts` están en la PR pero no en main. | No incorporar nuevos servicios ni otra coordinación de agentes sin revisión de alcance. Comparar piezas aisladas frente a infraestructura existente. |
| [#122](https://github.com/Victoriosas/autopilot/pull/122) Precio automático | `consultationPricePolicy.ts` existe en el head pero no en main. Su parche integra `buildAutomaticPriceReply` en `consultationAutoReply.ts` bajo nuevo flag. | Mantener bloqueada la integración automática: contradice la prioridad de respuesta humana supervisada y exige revisión comercial/seguridad. |
 
La comparación usó `fetch_file` en `main` y `refs/pull/<n>/head`, comparando hashes blob (igual/diferente/ausente). Se inspeccionaron parches concretos de los cuatro casos. **Igualdad de una ruta no implica que toda la PR esté incluida, ni diferencia implica que la PR sea mejor.** No se realizó revisión exhaustiva de todos los diffs.

## Hallazgos operativos y próximos pasos seguros

1. **#186**: al empezar la auditoría sus checks `validate`, `postgres`, CodeQL y análisis estaban aprobados; Supabase Preview omitida. No equivale a prueba remota. Revisar y fusionar manualmente según política, sin auto-merge.
2. **F2**: el inventario canónico contiene 11 faciales + 6 corporales. Las 17 fichas privadas requieren hechos y aprobación explícita de Victoria. No fabricar descripciones, duraciones, indicaciones o precios.
3. **F3**: revisar de manera focalizada evaluador y gateway de main, pruebas deterministas y coste total antes de cualquier inferencia externa. Conservar 40 casos congelados y 6 controles; no se acreditó guardián remoto ni atención automática.
4. **PR restantes**: registrar por separado #90, #111, #125, #168 y #169 para revisión posterior de obsolescencia/dependencias; no cerrar ni fusionar por mera antigüedad.
5. **PC**: antes de sincronizar, aplicar `docs/SYNC_PC_GITHUB_SEGURO.md`; no declarar estado local limpio o idéntico a main sin inspección de worktrees y archivos sin seguimiento.

**Estado:** análisis documental y hashes GitHub verificados, no ejecución funcional probada, no producción modificada. No habilitar auto-respuestas ni nuevos procesos paralelos OpenCode.
