# Segundo ciclo: endurecimiento real de disponibilidad F1

## Orden, base y resultado

El propietario autorizó el siguiente ciclo de la PR #217: una corrección real de bajo riesgo para F1, conservando supervisor y pruebas externas. La rama `codex/self-development-f1-20261110` se apila sobre #217 (`7e0a0c0926e7805cb50e397e27cd3586ba6db25b`), todavía sin fusionar; `origin/main` contrastado es `1c44a6389a7bbd6ac9157ac087269e216e654373`. No se duplica ni fusiona esa propuesta.

Se eligió un defecto de contrato verificable en `checkConsultationReadiness`: `!deps.enabled()` y los otros dos gates trataban valores truthy no booleanos como permiso. Por ejemplo, un adaptador que devuelve la cadena `"false"` podía permitir consultar almacenamiento y terminar `enabled:true`. El almacenamiento ya exigía `ready===true`; los gates locales ahora también exigen `true` explícito.

Es un endurecimiento real ante adaptadores defectuosos o tipos inválidos en runtime. Los adaptadores productivos actuales declaran booleanos; **no se afirma un incidente observado en producción**. No cambian los resultados para booleanos válidos, las razones saneadas, el timeout, abort, consentimiento, permisos administrativos ni envíos.

## Ejecución de Autopilot

La CLI recibió solo checkout aprobado, SHA y carpeta de laboratorio. Autopilot leyó el módulo real desde Git, validó su hash, ejecutó un corpus externo, observó 15 violaciones de 30 casos, derivó una misión y un plan de cuatro pasos, creó un worktree del repositorio real, escribió las tres correcciones y una regresión nueva, volvió a ejecutar el corpus externo y creó un commit local.

- Misión: `selfdev-f1-readiness`.
- Run: `f3522a92-b4e9-46ef-aa86-3ceec9d03f33`.
- Cierre: `2026-11-10T06:27:38.570Z`, `completed`, checkpoint 4 / journal 5.
- Candidato: `C:/autopilot-worktrees/readiness-autonomous-final-20261110/candidate`.
- Commit creado por Autopilot: `3ecc0333a7c4c2fc884df5779df9d56c566b521b`.
- Codex incorporó ese commit mediante cherry-pick, sin editar su parche, como `d811ee8` en la propuesta. El desarrollo del mecanismo y la publicación de la PR siguen a cargo de Codex.
- Evidencia estructurada: [SELF_DEVELOPMENT_F1_EVIDENCE_20261110.json](SELF_DEVELOPMENT_F1_EVIDENCE_20261110.json).

## Arquitectura y frontera de confianza

Nuevo adaptador `readinessDevelopment.ts` sobre los contratos y componentes existentes: `DevelopmentLedger`, `FileAccessController`, `PersistentMissionOrchestrator` y `ManagedProcesses`. **Los cuatro módulos supervisores de #217 no se modificaron.** No se agrega cola, servicio, scheduler, modelo ni SQL.

El observador/transformador reconoce exclusivamente el módulo revisado por hash y las ocho combinaciones posibles de tres sustituciones admitidas. Se permiten estados parcialmente corregidos y se deriva solo lo que falta. Una versión completa no genera otra reparación. Esto no es comprensión general de TypeScript ni generación libre de código.

La verificación externa transpila y ejecuta únicamente esas variantes exactas en un hijo acotado con entorno mínimo. No importa dependencias de la aplicación ni ejecuta scripts, hooks o pruebas arbitrarias del repositorio candidato. Su corpus permanece en el supervisor y comprueba 27 combinaciones de gates/valores inválidos, éxito válido, fallo de almacenamiento y timeout con abort. La prueba generada dentro del candidato no decide la aprobación: solo la acompaña y después se ejecuta en `npm run verify` supervisado por Codex/CI.

El host fija SHA, checkout limpio y raíz externa; la misión no puede cambiar comandos, credenciales, rutas ni oráculo. El manifiesto vincula esos recursos, el hash observado y la huella del supervisor. Se comprueban ambos archivos antes de escribir, se reconcilian efectos idénticos, y cambios desconocidos bloquean. El commit solo admite el módulo de disponibilidad y la regresión nueva. Hooks desactivados para los comandos propios. Sin push, merge ni deploy desde la misión; sin ampliación de permisos de nivel 3.

Presupuestos: cuatro pasos, una propuesta determinista, 45 segundos por invocación, tres por oráculo, cinco por Git; hereda topes de archivos/salida/journal y exclusión del ledger. No es un sandbox OS ni un sistema seguro para ejecutar programas hostiles. Permanecen las limitaciones documentadas de #217 sobre mismo usuario, carreras de filesystem, PID, journal truncado y falta de autenticación externa. La recuperación ante interrupción real se inicia manualmente o desde la prueba; no es desatendida.

## Pruebas y revisión

- RED independiente: módulo real sin modificar presenta 15 violaciones / 30 casos. GREEN: cero violaciones tras las tres sustituciones.
- Las seis correcciones parciales son rechazadas; solo la combinación completa aprueba. La transformación converge y no repite gates ya corregidos.
- Negativos: instrucciones agregadas, imports, cambio del timeout, relajación de la comprobación de almacenamiento, supervisor alterado, checkout sucio y carpeta con trabajo ajeno.
- Ciclo completo con Git real: parche, test y commit generados; segunda invocación conserva journal/hash/mtime y el checkout original sigue igual.
- SIGKILL real después del efecto y antes del checkpoint; otro proceso invoca la misma CLI y completa con `strict_gates_reconciled`, conservando mtime de la corrección. El arnés no aporta parche ni checkpoint.
- Revisión adversarial: se exigió checkout aprobado limpio y se adelantó la comprobación de carpeta ajena para evitar crear recursos dentro de ella. El ejecutor verifica identidad del worktree y alcance del diff antes del commit. No se relajan los controles anteriores.
- Validación completa y CI `validate`/`postgres` por SHA final se registran en la PR, junto con la comprobación de historial Vercel. Supabase Preview omitido no acredita integración alojada.

## Reproducción y reversión

Desde el checkout de esta propuesta, con Node 24 y dependencias instaladas:

```powershell
npm run development:readiness -- --repository C:/autopilot-worktrees/self-development-20261110 --base-sha 7e0a0c0926e7805cb50e397e27cd3586ba6db25b --lab-root C:/autopilot-worktrees/readiness-my-demo
node --import tsx --test src/autopilot/readinessDevelopment.test.ts
npm run verify
```

El checkout de entrada debe conservar el SHA y estar limpio; sustituir rutas por recursos explícitamente asignados. No usar ORD-204G como entrada ni laboratorio. Una nueva versión no revisada del módulo se rechaza y exige otra revisión de alcance. La carpeta conserva journal, manifiesto y candidato; no se elimina automáticamente.

Rollback de la aplicación: revertir por PR el commit de los tres gates y su test. Rollback del mecanismo: retirar el adaptador, CLI, script npm y documentación de este tramo, conservando #217. No hay datos, servicios, SQL alojado ni configuraciones globales que restaurar. Git deployments e ignoreCommand se limitan a las ramas de desarrollo, sin cambiar producción.

## Estado y próximo límite

Transferido: aplicar una transformación concreta a código real después de observar su fallo, crear una regresión, validar mediante corpus externo, crear commit y recuperar un efecto persistido. Codex sigue eligiendo/revisando el dominio, escribiendo el transformador/oráculo, iniciando la CLI, integrando el commit en la propuesta y observando CI.

ORD-204G no se modifica ni se activa anticipadamente. Esta sesión no programa su preparación. Próximo ciclo seguro: revisión de las PR apiladas y ampliación de otro contrato F1 únicamente con evidencia de fallo, autorización de alcance y corpus independiente; no habilitar generación libre o permisos generales por el éxito de este caso.
