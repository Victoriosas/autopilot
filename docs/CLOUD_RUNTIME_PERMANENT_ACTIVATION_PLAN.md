# Siguiente paso: continuidad y producción, todavía sin activar

Preparado el 24/11/2026, America/Montevideo, después de un ciclo cloud aislado
satisfactorio. Este documento no autoriza SQL en el principal, Cron, merge ni
promoción a `victoriosas.online`.

## Evidencia que permite avanzar

- Código ejecutado: `7c353f5e59b71be03958097a86ec8c47915f8197`.
- Supabase aislado `juyowvmtluxfetgkckjd`: seis tareas completadas en intento 1,
  seis claims, seis heartbeats y seis resultados, una sola invocación Edge.
- Pruebas alojadas de replay y lease vencida rechazadas, sin eventos extra.
- Preview `dpl_5LsMnVQQQJuYgbqPb1uXdUHDqRKo`, target Preview, mismo SHA, READY.
- Lector admin: 401 anónimo, 403 sin rol administrativo, 200 admin; seis filas
  persistidas visibles en escritorio y móvil. Contraseña del lector limitada a
  esta rama Preview; el servidor obtiene JWT de su rol restringido al leer.
- Política del ensayo cerrada y login del runner bloqueado al terminar.
- Main sigue en `82b6fb24e76d81e5026c94af2630358d00f2ebe9`; las seis bloqueadas
  del principal conservan fingerprint `607eb4a9f680ea6826964779f2f74f72`.

Receipt reproducible: `docs/CLOUD_RUNTIME_ISOLATED_RECEIPT_20261124.json`.
La prueba demuestra observaciones acotadas; no disponibilidad permanente ni
autonomía de desarrollo, atención clínica, seguimiento a clientas o envíos.

## Bloqueos que deben cerrarse antes de pedir activación productiva

1. **CI y revisión.** El titular debe resolver el bloqueo de facturación de
   GitHub; validate/postgres del SHA desplegado no llegaron a arrancar. No
   reintentar en bucle ni comprar capacidad. Exigir checks del candidato final,
   revisión y conversaciones resueltas. Vercel Security Review del código
   desplegado pasó. Supabase Preview omitido no es una prueba.
2. **Credencial del runtime renovable.** El ensayo usó un JWT de una hora emitido
   por Supabase Auth y suministrado por el invocador. No guardar ese JWT como
   credencial permanente de Cron. Preparar el login no interactivo de la misma
   identidad mínima en cada despertar, detrás del trigger exclusivo, con secreto
   guardado por el proveedor y nunca en el bundle. Probar vencimiento, revocación
   y renovación en aislamiento antes de activar periodicidad. No usar service_role
   como reemplazo. El lector Preview ya usa login del rol lector por petición.
3. **Costo y crecimiento.** Verificar uso/plan/cuotas existentes de Supabase y
   Vercel; no asumir costo cero. A 30 minutos, la aritmética es 48 ciclos/día,
   288 tasks/día y 864 eventos/día (aprox. 8.640 tasks y 25.920 eventos en 30
   días). Es estimación de volumen, no medición ni autorización de gasto.
   Definir retención que preserve el historial protegido y las bloqueadas.
4. **Alcance de roles.** La primera activación propuesta conserva solo lectura:
   verificación de artefacto, salud pública y agregados. No convertir este éxito
   en permiso para inferencia paga, código arbitrario, sourcing o comunicaciones.
5. **Preview clínica.** El ledger de ensayo no tiene los RPC de bandeja clínica ni
   settings de la aplicación completa; esas secciones muestran 503/404 y no
   forman parte de la prueba aprobada del lector de agentes. No copiar datos de
   clientas para hacerlas parecer operativas. Mantener la pausa de consultas.

## Paquete productivo propuesto para autorización posterior

1. Identificar un único candidato revisado y su bundle reproducible. Preparar PR
   y cambios de configuración; no modificar main ni desplegar producción bajo
   la autorización del ensayo.
2. Revisar y aplicar **solo después de autorización** el fencing y los RPC V3 al
   principal `jfjzpwlrhzqbcrvqxhzf`. No aplicar allí las fixtures de inbox/perfiles
   aislados. Conservar RLS, las seis bloqueadas y sus eventos; comparar los
   fingerprints antes y después.
3. Crear identidades técnicas propias del principal y permisos por RPC. No
   reutilizar contraseñas, JWT, sujetos o sesiones del ensayo. Probar negativos
   con anon, authenticated, reader y runner sin grants de tablas.
4. Preparar variables productivas separadas y el lector admin con el rol mínimo;
   verificar el menú contra persistencia real. Mantener envíos y sourcing apagados.
5. **Relevo ordenado:** detener y drenar los workflows runtime
   `victoriosas-infrastructure-availability.yml`, `six-agent-observability.yml`
   y la modalidad ejecutora de `plan-cloud.yml`. Conservar OIDC como mecanismo
   recuperable. No confundir CI con runtime. Comprobar disabled y cero runs activos.
6. Registrar el owner `supabase_cron`, `environment=production`, SHA aprobado,
   no_send y ventana autorizada solo después de confirmar el apagado de GitHub.
   El owner `manual_once` está expresamente prohibido para producción.
7. Preparar extensiones/Vault según cuotas y permisos aprobados. El SQL staged
   `cloud_runtime_v3_cron_REVIEW_ONLY.sql` rechaza scheduler previo y crea uno
   inactivo; requiere adaptar la credencial renovable del paso 2 de bloqueos.
   No aplicarlo ni activarlo durante el ensayo actual.
8. Promover el candidato a `victoriosas.online` únicamente con autorización
   específica y CI/revisión satisfechas. Verificar dominio, SHA, sesión admin y
   lector sin migraciones implícitas ni cambios de DNS.
9. Activar un único job cloud. Verificar al menos dos slots distintos por lectura
   independiente y después cerrar una ventana de observación con fallos, latencia,
   claims vencidos, costo y crecimiento medidos. Solo eso puede empezar a probar
   continuidad sin PC ni Actions.

## Rollback preparado

Desactivar primero el job cloud y la política, drenar leases y revocar el runner.
Conservar tasks/audit, resultados y bloqueadas. Revertir solo código/configuración
del candidato. Reactivar GitHub únicamente con autorización de rollback y después
de comprobar que cloud ya no ejecuta. Nunca ambos schedulers activos. No borrar
usuarios, datos, migraciones o evidencia como mecanismo de reversión.
