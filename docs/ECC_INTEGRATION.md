# Integración selectiva ECC en Victoriosas

Fuente: archivo local ECC-main.zip (10-10-2026). Upstream: https://github.com/affaan-m/ECC

Se incorporan cinco perfiles adaptados en `.opencode/agent/ecc-*.md`:
- ecc-code-reviewer: auditoría de diffs y calidad.
- ecc-security-reviewer: evaluación de vulnerabilidades.
- ecc-database-reviewer: revisión de SQL/Supabase, RLS y migraciones.
- ecc-build-error-resolver: diagnóstico de compilación.
- ecc-e2e-runner: plan y revisión de pruebas E2E.

Estos archivos **son instrucciones** de subagentes OpenCode, no procesos residentes, instalaciones de modelos ni trabajos programados. Están definidos con `mode: subagent` y sin proveedor/modelo fijo. Su ejecución depende de un runtime OpenCode disponible y su configuración. No se habilitan jobs ni hooks externos. No garantizan operación 24/7 ni costo de inferencia cero.

Guardrails aplicados: solo asesoramiento, sin comandos ni escrituras automáticas; sin credenciales, consultas privadas, publicidad autónoma, pagos, cambios de DNS ni promoción a producción. Cualquier propuesta pasa por revisión y CI según `AGENTS.md`. El archivo ECC de origen puede mencionar herramientas o permisos más amplios, que quedan subordinados al encabezado Victoriosas.

Prueba de activación recomendada en un entorno local autorizado: ejecutar OpenCode en una rama de prueba, invocar `@ecc-code-reviewer` sobre un diff sintético, comprobar que no escribe y registrar evidencia de salida. Repetir para los otros cuatro. Sin dicha prueba, la integración queda **preparada pero no operativa comprobada**.

Licencia: el contenido de los perfiles deriva del repositorio ECC, distribuido bajo MIT. Conservar el aviso de licencia incluido en `docs/third_party/ECC_LICENSE.txt`.

No duplicar `.github/workflows` existentes; ninguna automatización adicional fue habilitada en esta integración.
