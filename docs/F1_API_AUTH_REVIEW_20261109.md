# F1 · Revisión conjunta de API y autenticación · 09/11/2026

## Alcance y base

Integración aislada en `codex/f1-api-auth-review-20261109` desde main `a6cff5aba04e752cb010926b88c24fd4abfe84b6`:

| Propuesta | Head revisado | Resultado esperado |
| --- | --- | --- |
| [#200](https://github.com/Victoriosas/autopilot/pull/200) | `039ecf3503cb74b8f7c32b1fd4e8d71b7fa2f72a` | Montaje compartido de API para Node, Vercel y Edge |
| [#201](https://github.com/Victoriosas/autopilot/pull/201) | `7da72d3634c378d4cd1f6b41aa99b30f0a6001ce` | 404 JSON de API, builds separados y arranque Node de producción |
| [#202](https://github.com/Victoriosas/autopilot/pull/202) | `eb92a0cef9c5d50ea578f4a532e7b56cb600cdab` | Distinguir indisponibilidad de Auth/DB del rechazo de identidad o rol |

#201 contiene #200. Se incorporaron sus commits originales y después #202, sin duplicar cambios. El único conflicto fue documental: se conservaron las notas de ambas ramas y las habilidades v2 de main. Ningún conflicto de código.

## Revisión del conjunto

- `createApp` registra consultas antes del parser general: su disponibilidad y origen se comprueban antes de procesar el cuerpo. Se conservan límites, consentimiento e idempotencia.
- El montaje compartido mantiene los guardas existentes y las diferencias deliberadas de cabeceras y metadatos de cada entrada. La autenticación administrativa verifica `getUser(token)` y consulta el perfil con el JWT del solicitante.
- #202 cambia únicamente la clasificación de errores: la indisponibilidad responde 503, un token rechazado 401 y la falta de rol 403. No habilita acceso cuando falla el proveedor.
- Node registra el 404 de API después de sus rutas y antes del fallback HTML. Vercel conserva el mismo contrato JSON. GET/POST/HEAD desconocidos se comprueban contra ambos bundles.
- Node compila en `dist-node` y Vercel en `dist`; la segunda compilación ya no elimina la primera. El smoke arranca Node con entorno mínimo, directorio temporal vacío y host loopback.
- Docker declara Node 24 y `NODE_ENV=production`, usa lockfile y copia entradas explícitas. No hay Docker disponible en esta PC: la imagen real en contenedor sigue sin probarse.
- No se modifican migraciones, claves, DNS, configuración alojada, pagos, permisos profesionales ni canales de envío. La compilación local de Edge no demuestra su ejecución alojada.

## Validación y decisión

Validación local del conjunto: `npm run verify` terminó correctamente con 432/432 pruebas, cero omitidas, TypeScript, 13 habilidades, ambas compilaciones y smoke de ambos bundles. HTML, recursos, rutas, escaneo de secretos y `git diff --check` correctos. La API Supabase Edge compiló con dependencias fijadas al lockfile. Los checks del SHA final constan en la PR de integración. Los checks individuales de los originales no se atribuyen al conjunto.

El candidato se prepara para revisión; no es una publicación. Supabase Preview omitida no equivale a una prueba de integración alojada. Mantener la aprobación específica para cualquier promoción a producción. No fusionar automáticamente las PR originales ni la integración.

## Reversión y siguiente paso

Antes de publicar, revalidar main y los heads originales. Si cambian, volver a revisar su diferencia. Conservar `a6cff5a` como base de comparación; las ramas originales permanecen intactas. Revertir el futuro commit de integración mediante una PR revisable si fuera necesario; no hay SQL que deshacer.

Después de una publicación específicamente autorizada, comprobar health/SHA, configuración del formulario, rechazo anónimo, HTML y recursos. Cualquier canario con envío requiere autorización separada; esta revisión no lo ejecuta.
