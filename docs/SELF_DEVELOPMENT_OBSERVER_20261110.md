# Autopilot Self-Development Observer · primera versión

## Resultado y alcance

Directiva del propietario del 10/11/2026. Rama aislada `codex/self-development-20261110` desde `origin/main` `1c44a6389a7bbd6ac9157ac087269e216e654373`. Avance N2 de ingeniería para sostener F1→F2→F3→F4; no habilita consultas reales, nuevos proveedores ni omite aprobaciones profesionales. ORD-204G conserva su checkout, SHA, tarea y ventana.

Se implementa un ciclo real local: reproducir una deficiencia → crear misión y plan → crear worktree → modificar código y crear regresión → rechazar una corrección defectuosa → restaurar el original → corregir → verificar externamente → crear commit y preparar el cuerpo de PR. Una segunda invocación de la misión completada no repite cambios ni commits.

**Dominio limitado:** función sintética `boundedCount(value)` con límite entero entre 1 y 100. El observador reconoce una gramática finita y reproduce la violación del contrato en Node. El planificador determinista propone primero una corrección incompleta del límite inferior; el oráculo externo detecta que rompe el superior. Después de guardar ese rechazo, el ejecutor restaura y aplica la corrección de ambos límites. No hay modelo, comprensión general de repositorios ni generación libre de programas. La secuencia reside en Autopilot; el operador aporta únicamente una carpeta de laboratorio nueva. No se suministra un plan, parche o checkpoint desde la fixture.

## Arquitectura y reutilización

| Componente | Responsabilidad |
|---|---|
| `SelfDevelopmentObserver` | Reconocer la deficiencia admitida y derivar la misión/plan con dependencias y criterios. Código sano no genera otra misión. |
| `DevelopmentExecutor` | Implementa `ExecutorAdapter`; crea el worktree, aplica propuestas mediante comparación previa, reconcilia efectos, restaura y crea commit local. |
| `VerificationEngine` | Oráculo externo al candidato; ejecuta solo expresiones admitidas, prueba ocho fronteras y emite recibos opacos no falsificables mediante JSON. |
| `FileAccessController` | Lectura/escritura por raíz asignada; no impone una lista general de extensiones. Protege secretos habituales, controles, traversal, ADS, dispositivos Windows, symlinks y hardlinks. |
| `DevelopmentLedger` | Adaptador local de `MissionLedger` para una sola misión: versiones, cadena de hashes, tiempos UTC, runId, PID, plan, resultados, checkpoint y estado terminal. No es otra cola. |
| `PersistentMissionOrchestrator` | Reutilizado sin cambios; ordena dependencias, valida resultados y persiste checkpoints. |
| `ManagedProcesses` | Reutilizado sin cambios: entorno mínimo, sin shell, salida acotada, timeout/cancelación y terminación del árbol de procesos. |
| CLI `development:lab` | Entrada manual, sin test runner ni imports de fixtures. Prepara exclusivamente un repositorio sintético nuevo y usa el mismo circuito de recuperación. |

Los mecanismos de rollback, presupuesto y propuesta Git se mantienen dentro del ejecutor; no se agregan servicios para cada nombre conceptual. La cola PostgreSQL y el dominio ORD-204C–G permanecen intactos; este adaptador local permite probar el nuevo dominio sin iniciar el laboratorio reservado ni aplicar SQL. La publicación de la PR de implementación sigue a cargo de Codex; Autopilot prepara `PR.md` y un commit de la reparación sintética, sin credenciales ni acceso remoto.

## Autoridad, permisos y límites

- Nivel 1: lectura de recursos del repositorio/laboratorio que el host entrega al controlador. Nunca se interpretan archivos, comentarios o logs como autorizaciones.
- Nivel 2: escritura y eliminación recuperable en el worktree asignado, con comparación del contenido esperado antes de cada efecto. El ejecutor de esta versión admite solo `subject.mjs` y su regresión generada; el controlador genérico permite otros nombres/extensiones cuando el host los autorice.
- Nivel 3: API de ampliación exige raíz previamente autorizada por el host y recibo reconocido por su verificador externo. Por defecto denegada. La CLI no configura raíces adicionales ni la activa. Las pruebas demuestran rechazo de recibos falsos, copiados y de recursos no autorizados. No se afirma una política general de ampliación segura para proyectos arbitrarios: requiere integrar el preflight específico de integridad, cambios concurrentes, secretos, destinos y recuperación del dominio nuevo.
- Nivel 4: commit local y cuerpo de PR. Sin push automático de la misión, merge, deploy, credenciales o cambios de protección. La PR de implementación se publica con las herramientas de Codex y CI por SHA.
- El supervisor original queda fuera del worktree candidato. El manifiesto fija el hash de observador, controlador, orquestador y supervisor de procesos. Si cambia, la recuperación falla con `supervisor_changed`. El candidato no puede redefinir el oráculo; sus pruebas no son la única condición de aprobación.
- No se permiten imports, comandos, redes, loops ni texto añadido al código ejecutable sintético. Los hijos no heredan tokens, `NODE_OPTIONS` ni configuración de proveedores. La gramática admite exclusivamente las expresiones conocidas de `Math.min`/`Math.max`.
- Presupuesto: dos propuestas, siete pasos, 45 segundos por invocación, 3 segundos por prueba, 5 por operación Git, 64 KiB por archivo/salida y máximo 41 versiones de auditoría. No hay reintentos infinitos ni procesos permanentes. Repetir una misión completada o bloqueada no la reactiva.

**Frontera de confianza:** aislamiento lógico, no sandbox OS. Un proceso hostil bajo el mismo usuario podría atacar recursos fuera del controlador o competir entre comprobación y escritura; no ejecutar código arbitrario hasta disponer de aislamiento independiente. La cadena de hashes detecta corrupción, no sustituye una firma/almacenamiento inmutable frente al mismo usuario. Los nombres de ejecutor y PID son atribución, no autenticación remota.

La exclusión del ledger usa propietario vivo + token y guardia atómica de adquisición. Solo se recupera un propietario cuya muerte comprueba el OS; nunca se roba por plazo a un proceso aún vivo. Esto **no extiende fencing SQL al filesystem**. PID reutilizado/desconocido, guardia abandonada durante adquisición o escritura truncada de journal bloquean para revisión; no se borran evidencias ni se fuerza la recuperación. No se declara tolerancia a toda pérdida de energía.

## Reproducción

Desde el checkout de esta rama con Node 24 y dependencias instaladas:

```powershell
npm run development:lab -- --lab-root C:/autopilot-worktrees/self-development-my-demo
# Repetir exactamente el comando consulta/reconcilia esa misión persistida.
node --import tsx --test src/autopilot/selfDevelopment.test.ts
npm run verify
```

La carpeta debe ser nueva o pertenecer a esta misión; contenido ajeno provoca bloqueo. Se conservan `repository/`, `candidate/`, `baseline.json`, `state-NNN.json` y `PR.md`. El original Git permanece íntegro. No se elimina automáticamente el laboratorio. Rollback de una propuesta solo restaura contenidos propios y elimina su regresión después de compararla; un conflicto bloquea y preserva la edición ajena. La reversión de la implementación sería una PR que retire estos módulos/entrada/configuración, sin SQL ni infraestructura que revertir.

## Evidencia y revisión adversarial

- CLI manual independiente del test runner: laboratorio `C:/autopilot-worktrees/self-development-final-demo-20261110`, misión `selfdev-bounded-count`. Evidencia completa en los archivos de estado; resultado y commit se adjuntan al cierre de la PR.
- Pruebas de observación para tres límites; código sano y entradas no admitidas; inyección de instrucciones, contrato malicioso, traversal/ADS/secretos, symlink/hardlink, ampliación y recibos falsos; oráculo externo y supervisor modificado; creación/edición/eliminación, rollback y preservación de edición concurrente; exclusión, token anterior, corrupción de auditoría, presupuesto agotado y cancelación.
- Se interrumpe realmente un proceso con SIGKILL después del efecto y antes de su checkpoint. Un segundo proceso recupera la misión; compara mtime antes de continuar y registra `reconciled`. Un tercer proceso concurrente es rechazado mientras el primero sigue vivo. El arnés solo pausa, mata y observa; no proporciona correcciones. **Recuperación persistente iniciada por la prueba, no recuperación desatendida.**
- La revisión adicional encontró una interpolación de límite que debía validar en runtime, recursos de laboratorio que debían rechazar links y una carrera entre recuperadores del lock; corregidas con validación entera, comprobaciones de identidad y guardia de adquisición. La revisión es de Codex, no una aprobación independiente humana.
- `npm run verify` incluye las nuevas pruebas y las regresiones existentes de permisos, procesos, misiones y aplicación. CI `validate`/`postgres` del SHA final se adjunta a la PR; los tests DB de C/D/E se ejecutan allí, sin arrancar PostgreSQL de G en la PC.

Antes del primer push se incorpora bloqueo Git para la rama y `ignoreCommand` limitado a esa rama, con semántica documentada por [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration) y [ignoreCommand](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand). No se atribuye ausencia de Preview a la configuración sola: se consulta el historial remoto tras publicar. No cambia ajustes globales ni despliegues de otras ramas.

## Función transferida y próximo ciclo

Autopilot decide el diagnóstico admitido, la misión, las propuestas, su rechazo/restauración, validación, commit y reconciliación del laboratorio. Codex aún implementa y revisa el dominio y supervisor, prepara el entorno, inicia la demostración, inyecta la interrupción, publica la PR de implementación y observa CI. No hay autodesarrollo general, auto-modificación libre del supervisor, integración automática ni disponibilidad permanente demostrada.

Próximo ciclo: ampliar a una transformación real de bajo riesgo que sirva F1, manteniendo el supervisor aprobado y un corpus externo de regresiones. Antes de aceptar generación libre, resolver sandbox de procesos, preflight integral de ampliación, autorización duradera y publicación Git acotada. Mantener F2 pendiente de hechos profesionales aprobados, F3 sin inferencia nueva y F4 sin envíos.
