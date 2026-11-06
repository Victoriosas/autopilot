# Victoriosas | Estética profesional + Autopilot

Repositorio de [Victoriosas](https://victoriosas.online), sitio público de servicios estéticos profesionales, y de **Autopilot**, su plataforma interna de consultas, conocimiento aprobado y agentes IA supervisados.

> **Dirección vigente:** [docs/PROJECT_DIRECTION.md](docs/PROJECT_DIRECTION.md). Para cualquier intervención, leer primero [AGENTS.md](AGENTS.md). Los documentos y componentes de ecommerce conservados por compatibilidad son históricos, no la estrategia actual.

## Experiencia y operación

- **Sitio público:** servicios faciales y corporales, presentación de Victoria, contenido editorial y consulta inicial remota mediante `/consultanos` o WhatsApp.
- **Atención:** recepción con consentimiento, expediente privado, bandeja administrativa, borrador y envío supervisado con aprobación humana.
- **Conocimiento profesional:** 17 tratamientos canónicos. Las fichas privadas deben revisarse y aprobarse expresamente por Victoria antes de utilizarse como evidencia para IA.
- **IA:** laboratorio de Comprensión → Recuperación → Redactor → Guardián → validaciones deterministas → revisión. No equivale a atención autónoma activa.
- **Restricciones:** sin atención a domicilio, diagnósticos automatizados, precios públicos, agenda abierta, carrito, checkout, compras, dropshipping ni campañas automáticas.

## Responsabilidades y herramientas

**Codex es la herramienta principal de desarrollo y ejecución técnica.** Las habilidades del repositorio residen en [`.agents/skills/`](.agents/skills/) y se enumeran en [docs/CODEX_SKILLS.md](docs/CODEX_SKILLS.md). OpenCode es una alternativa secundaria, manual y opcional; no debe competir con Codex por los mismos archivos o procesos. La existencia de skills, agentes o cron en GitHub no demuestra ejecución continua.

Infraestructura relacionada: GitHub Actions, Vercel, Cloudflare, Supabase, Resend y laboratorio camelRun. Su estado productivo se verifica por separado, nunca por la sola existencia de una configuración.

## Desarrollo local

Requiere Node.js 24. Las variables se documentan en `.env.example`; los secretos permanecen fuera del control de versiones.

```bash
npm ci
npm run dev
```

Validación de código antes de proponer una PR:

```bash
npm run verify
```

Para rutas con PostgreSQL, Auth, RLS o correo, ejecutar además los tests específicos y revisar los checks `validate` y `postgres` del SHA final. Una prueba simulada no certifica la integración alojada.

## Organización del repositorio

- `src/components/public/`: sitio público, catálogo y formulario.
- `src/components/admin/`: administración de consultas y fichas.
- `src/storefront/consultation*`: lógica de consultas, conocimiento y laboratorio.
- `supabase/migrations/`: migraciones versionadas; no aplicar remotamente sin autorización específica.
- `.github/workflows/`: validaciones y tareas de infraestructura.
- `docs/`: dirección, auditoría, pruebas y continuidad.
- `src/autopilot/`, `src/payments/`, `src/components/store/`: módulos históricos de comercio mantenidos por seguridad/compatibilidad, no autorizados para reactivar ventas.

## Estado verificable y próximas fases

El código y los documentos del repositorio indican qué está **definido o fusionado**, no necesariamente qué está **desplegado o ejecutado**. Contrastar SHA en GitHub, CI, entorno público, Supabase y proveedores antes de reportar éxitos. La prueba controlada F1 y las pendientes F2/F3 constan en [docs/PROJECT_DIRECTION.md](docs/PROJECT_DIRECTION.md) y [docs/F2_REVISION_VICTORIA_17_TRATAMIENTOS_20261104.md](docs/F2_REVISION_VICTORIA_17_TRATAMIENTOS_20261104.md).

Trabajar en ramas y PR revisables; no publicar, fusionar o activar mensajes automáticos por iniciativa propia. Sin secretos ni datos de clientas en Git, CI, logs o capturas.
