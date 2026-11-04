---
name: victoriosas-consultas-e2e
description: Diagnosticar y probar el formulario /consultanos de Victoriosas, su API, Supabase, Resend y bandeja administrativa con casos sintéticos. Usar ante fallos de envío o cambios en consultas; no para campañas.
---

# Consultas: diagnóstico de extremo a extremo

## Inicio mínimo
1. Seguir las restricciones de `AGENTS.md`. Verificar rama, cambios locales y SHA actual. No modificar `main` directamente.
2. Examinar solo `src/components/public/ConsultationForm.tsx`, el adaptador API de consultas, pruebas relacionadas y el código de bandeja afectado. Buscar rutas exactas antes de leer archivos grandes.
3. Diferenciar las seis etapas: renderizado, `GET /api/beauty/inquiries/config`, `POST /api/beauty/inquiries`, persistencia, aviso Resend y lectura autenticada en el panel.

## Método
- Reproducir primero la falla en navegador real, incluyendo consola y red. `HTTP 200` de config no demuestra un formulario operativo.
- Revisar CORS, timeout, validación, consentimiento, captcha/honeypot, deduplicación, retención y degradación segura. El formulario puede mostrarse, pero el envío debe quedar bloqueado si no se confirma disponibilidad.
- Probar normalización y validaciones con datos FICTICIOS en entorno aislado. No introducir identidades, números o emails reales en fixtures, capturas o logs.
- Por defecto usar mocks y simulaciones de Resend; no hacer POST al entorno productivo ni enviar mensajes reales sin autorización específica para esa prueba.
- Si una integración remota no está disponible, marcar NO VERIFICADA, no reemplazarla con una simulación presentada como evidencia real.
- Validar control de acceso de `/api/beauty/inquiries/admin` sin eludir autorización y sin volcar información de clientes.
- Mantener los estados de consulta y aprobación explícita; jamás convertir un borrador de IA en email enviado.

## Pruebas y entrega
- Ejecutar pruebas de la ruta modificada, `npm run verify` antes de PR y checks CI/PostgreSQL pertinentes. Si no hay navegador disponible, declararlo.
- Entregar una matriz de seis etapas con resultado (OK, FALLA o NO VERIFICADA), prueba reproducible, SHA, riesgo y próximo paso.
- Reutilizar el flujo existente; no crear otra bandeja, outbox ni servidor de consultas.
