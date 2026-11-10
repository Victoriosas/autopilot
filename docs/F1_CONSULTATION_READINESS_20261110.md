# F1 · Disponibilidad acotada y diagnóstico determinista

Investigación de configuraciones cerrada primero en PR #214, SHA ec121f2fc2a678d8b602c29eea4b26345910eacc. Esta mejora se apila sobre ese cierre en `codex/f1-readiness-20261110`, sin incorporar ni duplicar #204 (montaje/auth), ni ORD-204G. El checkout aprobado y sus recursos operativos permanecen intactos.

## Problema demostrado y resultado

Antes, `/api/beauty/inquiries/config` devolvía enabled=false sin una causa que el monitor pudiera clasificar; `store.ready()` podía esperar sin un plazo explícito propio. Una prueba HTTP roja reprodujo unavailableReason ausente ante fallo del almacenamiento. El operador/Codex debía investigar una indisponibilidad genérica y un proveedor que no respondiera podía dejar pendiente el chequeo.

[checkConsultationReadiness](../src/storefront/consultationReadiness.ts) ahora aplica una política compartida por GET config y la precondición del POST de admisión. Cierra por gates apagados, configuración incompleta, canal de aviso no configurado, almacenamiento no disponible o timeout. La espera de almacenamiento tiene un techo fijo de tres segundos y propaga AbortSignal al RPC existente; no admite ni envía durante la comprobación. Una respuesta tardía no reabre el resultado ya cerrado.

Cuando enabled=false, config añade `unavailableReason` de una allowlist: disabled, configuration_incomplete, notification_unavailable, storage_unavailable o storage_timeout. No incluye mensajes del proveedor, secretos, tablas ni datos de consultas. El payload enabled=true conserva su contrato anterior. El frontend no cambia. notificationReady refleja configuración del canal, no una prueba de entrega real.

El [monitor existente](../scripts/public-health.mjs) clasifica solo esos motivos; cualquier otro valor se convierte en unknown y no se imprime. No se agrega scheduler, endpoint, modelo ni cola. No se ajustan los horarios existentes. El POST sigue respondiendo 503 antes de admisión si el almacenamiento no está listo. Idempotencia, consentimiento, aprobación y canales de respuesta no cambian.

## Pruebas y revisión adicional

- RED: prueba HTTP real en loopback rechazó la ausencia de storage_unavailable; log `C:/autopilot-worktrees/f1-readiness-red.log`.
- GREEN focal: 11/11 entre nuevas pruebas de disponibilidad y monitor. Gates tempranos no consultan almacenamiento; errores privados no se exponen; almacenamiento que no responde cierra y recibe abort; resultado tardío no habilita el chequeo.
- La prueba del builder real Supabase usa transporte falso y URL synthetic.invalid: confirma que el RPC recibe el AbortSignal, con una sola llamada y sin SQL alojado ni credenciales reales. API contrastada con la dependencia instalada y [documentación oficial](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js); changelog público leído, sin cambio de SDK o migraciones.
- HTTP GET y POST con almacenamiento que ignora la señal terminan tras el plazo, con cero llamadas a claim, finish o send. El adaptador de producción sí propaga la cancelación al transporte. No se afirma que un adaptador arbitrario o un proceso hostil obedezcan la señal.
- El monitor se prueba con causas conocidas y texto privado no admitido; solo efectúa GET. No se envía un formulario real ni se usa Resend, IA o datos de clientas.

Validación completa y CI por SHA final se registran en la PR. Log local de la ejecución completa: `C:/autopilot-worktrees/f1-readiness-verify.log`. Revisar validate/postgres del SHA final; Supabase Preview omitido no acredita integración alojada. Git deployments de esta rama desactivados antes del primer push.

Revisión adversarial: errores y razones desconocidas se sanejan; flags y configuración se comprueban antes de red; no se modifica el motivo por una respuesta fuera de plazo; abort llega al RPC; storageReady conserva false ante excepción de creación del cliente; timers se limpian al terminar y fallos del SDK no llegan al cuerpo HTTP. El diagnóstico es disponibilidad del contrato, no garantía de recepción, cobertura permanente o validación de producción.

## Transferencia y reversión

Función transferida: clasificar automáticamente la indisponibilidad del circuito de consultas y cerrar su precondición dentro de un plazo, mediante política en Autopilot y su monitor existente. Reduce la dependencia de una inspección de Codex para distinguir el fallo genérico. Aún requiere revisión/merge/publicación autorizados y canario específico para acreditar el recorrido real; esta orden no los ejecuta.

Reversión mediante PR del commit de código: retirar helper/razones y restaurar chequeo/monitor previos, sin SQL, datos o ajustes globales que deshacer. La corrección global de instrucciones tiene su respaldo independiente documentado en #214. Siguiente orden segura: revisión conjunta con #204 y validación de integración local, o prueba G exclusivamente dentro de su ventana ya autorizada; no adelantarla ni reprogramarla.
