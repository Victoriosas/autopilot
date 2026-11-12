# PLAN Cloud · activacion inicial

El workflow `.github/workflows/plan-cloud.yml` ejecuta una auditoría P0 de solo lectura.
El modo `inventory` no usa modelos ni claves externas; consulta las PR abiertas y el SHA
de `main` con el token de GitHub de permiso mínimo y guarda `inventory.json` y `report.md`
como artefactos durante 14 días. No crea automatizaciones periódicas, issues ni PR adicionales.

La ejecución se habilita en Actions cuando este workflow exista en la rama predeterminada
(tras la revisión e integración de esta PR). Mientras tanto el evento `pull_request`
valida el inventario sobre la rama de trabajo.

Para activar el modo `codex` opcional, configurar el secreto
`OPENAI_API_KEY` en los ajustes del repositorio y elegir `Run workflow → codex`.
Usa la acción oficial de Codex y requiere facturación API por separado. El secreto
no debe registrarse en archivos, logs ni prompts. Modo solo lectura: no autoriza
cambios, envíos, despliegues ni fusiones. La salida se conserva como artefacto.

No se configura `schedule`: ya existe un heartbeat para Victoriosas.
La auditoría P0 no demuestra el estado de escritores del PC, servicios externos ni CI.
Para modificaciones futuras se exige reconciliar worktrees, responsables y evidencia.

## Traspaso durable después de CI (P0, 12/11/2026)

El mismo workflow escucha la finalización de `Autopilot Core v4` y conserva
`continuation.json` con SHA/run y bloqueo. No ejecuta código del disparador ni
descarga sus artefactos. Sin adaptador autorizado al ledger cloud falla cerrado;
no interpreta una CI verde como permiso de misión. No agrega cron.
Entrada local recuperable y límites: [continuidad P0](AUTONOMY_CONTINUITY_20261112.md).
