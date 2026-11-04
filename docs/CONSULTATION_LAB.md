# Laboratorio de consultas · revisión humana obligatoria

## Actualización: simulación sin esquema privado (4 de noviembre de 2026)

Hasta que se aplique y verifique la migración privada de conocimientos, **Probar IA** conserva la posibilidad de ejecutar únicamente casos sintéticos, con **cero fichas** y sin conectar camelRun. La respuesta incluye `knowledgeUnavailable: true` y el panel advierte expresamente que esta prueba **no valida Supabase, correo, ni agentes remotos**. La ausencia de evidencias debe activar los bloqueos del Guardián; no hay sustitución con datos antiguos ni precios.

**Fichas privadas para Victoria** sigue devolviendo error cuando falta el esquema. No se simula guardado ni se modifica base de producción. Todos los envíos permanecen deshabilitados.


Rama inicial: `codex/consultation-synthetic-ai-lab`, desde `e00680a448508b27946766cd972494c83c7296e0`.

## Alcance y límites

El panel privado de consultas incorpora **Probar IA (simulación)**. Solo admite identificadores de seis casos sintéticos fijados en el servidor; no recibe textos libres ni identificadores de consultas reales. Reutiliza `analyzeConsultation`, sus tres etapas y sus reglas de modo sombra. No tiene acceso a envío de respuestas, avisos, cron ni compras. Los resultados identifican claramente el proveedor `synthetic-simulation`: no representan ejecuciones de camelRun.

Los agentes `victoriosas-lab-comprension-free`, `victoriosas-lab-redactor-free` y `victoriosas-lab-guardian-free`, y el modelo `google/gemma-4-31b-it`, figuran como destinos pendientes. No se modificaron agentes originales. **La conexión remota todavía no está implementada ni validada**: faltan credencial, acceso a la documentación/API y comprobación del contrato de ejecución por agente y coste total cero. Un modelo gratuito no prueba gratuidad de runtime o almacenamiento; un límite de gasto entre llamadas tampoco la garantiza. El backend rechaza cualquier proveedor remoto en este laboratorio. No habilitar el generador histórico de pago ni usarlo como alternativa.

## Fichas de Victoria

La migración `20261104030000_consultation_service_knowledge.sql` agrega los 17 nombres del catálogo público como borradores en `beauty_services`, sin completar descripciones, duración, tarifas ni disponibilidad. Conserva las cuatro fichas existentes y no cambia la publicación pública. Las revisiones internas se guardan en `private.consultation_service_knowledge`, vinculadas a `beauty_services`; los clientes anónimos no pueden leerlas.

En **Fichas privadas para Victoria**, cargar los tratamientos, elegir una ficha, completar únicamente información confirmada y aprobar expresamente la descripción para IA. Cada guardado crea una versión y rechaza cambios sobre una versión desactualizada. Editar contenido en el panel desmarca ambas aprobaciones.

- `approvedForAI`: autoriza la descripción general vigente como fuente del laboratorio.
- `priceApproved`: constancia separada sobre una tarifa **interna**. No se entrega a IA ni web.
- `beauty_services.publication_status`: control editorial existente, independiente; el laboratorio no lo modifica.

Técnicas, duración, condiciones y preguntas frecuentes quedan como notas privadas editables. Esta primera versión proyecta únicamente la descripción aprobada hacia el analizador, con fuente y versión. No convierte automáticamente todas las notas en afirmaciones para clientes. Una revisión nueva sin aprobar invalida el uso de la anterior; no hay fallback a versiones viejas. La vigencia vencida también excluye la ficha. Sin datos suficientes, queda pendiente de Victoria. Incluso una descripción aprobada pasa filtros deterministas contra tarifas, promesas e indicaciones personales.

La migración se probó solo localmente. **No se aplicó a Supabase principal**; aplicarla remotamente requiere autorización específica y reconciliar el historial de migraciones. El panel devuelve un error si falta el esquema; no simula persistencia exitosa.

## Pruebas reproducibles

1. `npm ci` con Node 24 y `npm run verify`.
2. `node --import tsx --test tests/migration-history.test.ts`.
3. Para PostgreSQL, usar `node scripts/test-consultation-postgres.mjs` con PostgreSQL instalado; cubre concurrencia, idempotencia, estados y borrado por retención.
4. Para Auth/PostgREST, reproducir el fixture desechable de `.github/workflows/beauty-supabase.yml`, Supabase CLI 2.120.0, **fuera del checkout y sin enlazar proyectos remotos**. El workflow copia solamente el baseline y las migraciones Beauty/consultas.
5. Guardar `supabase status -o json` del stack local en un archivo privado, sin imprimir claves. Ejecutar:

```sh
BEAUTY_SYNTHETIC_SUPABASE=true \
SUPABASE_LOCAL_STATUS_FILE=/ruta/privada/beauty-status.json \
node --import tsx --test tests/consultation-supabase.test.ts
```

6. Instalar Playwright 1.56.1 fuera del checkout, sin cambiar manifests o lockfiles. Con el mismo fixture:

```sh
BEAUTY_SYNTHETIC_SUPABASE=true \
SUPABASE_LOCAL_STATUS_FILE=/ruta/privada/beauty-status.json \
CONSULTATION_PLAYWRIGHT_MODULE=file:///ruta/playwright/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium \
node --import tsx scripts/test-consultation-lab-browser.ts
```

`CHROMIUM_PATH` es opcional si Playwright tiene instalado su Chromium. El navegador intercepta todas las peticiones del origen de prueba y las lleva al servidor local; no visita producción. El adaptador Resend recibe un transporte simulado, comprueba la plantilla y cuenta avisos interceptados: no se envían correos. El script genera capturas sintéticas en `output/consultation-lab/`. CI también ejecuta este recorrido y conserva sus capturas como artefacto.

En este entorno el registro predeterminado ECR estaba bloqueado; se utilizó la opción soportada `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. El healthcheck de Auth con BusyBox wget enviaba la petición a loopback por el proxy y obtenía 403, aunque `/auth/v1/health` respondía correctamente por el gateway local. Se conservó temporalmente el stack con `--ignore-health-check` **solo para diagnóstico** y se validó mediante peticiones reales, creación/login de identidades sintéticas y pruebas de Auth/PostgREST. Ese flag no acredita salud ni sustituye esas comprobaciones.

## Resultados y pendientes

- Verificación principal: 397 aprobadas, 0 fallidas, 1 omitida por el suite; tipos y ambas compilaciones correctos.
- Supabase local: 8 pruebas aprobadas; PostgreSQL de consultas: 12 aprobadas; inventario de migraciones y simulación Resend: correctos.
- Evaluaciones adversariales existentes ejecutadas dentro de `npm test`. La evaluación de agentes en `--dry-run --split desarrollo` confirma selección de 32 casos y 6 controles; **no acredita una evaluación remota del LLM**.
- Coste de proveedores en esta misión: US$0, porque no se ejecutaron modelos remotos ni envíos reales. Tokens de modelo: no aplican/desconocidos; no se inventa telemetría.
- La comprobación remota de producción fue bloqueada por la política de red. El código del formulario exige `enabled=true`, `privacyVersion=consultation-v1` y `retentionDays=30`; `enabled=true` aislado no prueba disponibilidad. No se confirmó la causa del incidente observado en producción.
- Pendiente: acceso a `api.github.com` para crear PR/consultar CI, `victoriosas.online` para investigar el incidente real y `run.camelai.com` con credencial segura para verificar el contrato de los agentes y sus costes. Estos requisitos se guardaron en el borrador del entorno de desarrollo; no se cambió producción.
- Tras resolver acceso, terminar el adaptador remoto exclusivamente sintético, validar esquemas/consumo de los tres agentes con coste total cero comprobado, ejecutar los casos congelados completos y revisar `validate`, `postgres` y `beauty-stack` del SHA final. No fusionar ni desplegar manualmente.
