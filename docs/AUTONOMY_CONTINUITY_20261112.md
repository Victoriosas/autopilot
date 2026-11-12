# Continuidad durable P0 · 12/11/2026

Base: main `30e9f41c0713ee1692aeefe0a26e16931d0fe4b1`, confirmada con el conector GitHub.
F0/N2: infraestructura de recuperación; no adelanta las fases de consultas.

## Mecanismo

El heartbeat existente puede invocar una vez por turno:

```text
npm run mission:local -- resume --config <configuración del host> --id <misión ya admitida>
```

No admite objetivos nuevos ni comandos arbitrarios. Recupera el mismo `agent_tasks`,
plan y checkpoint mediante `LocalMissionStore` y `PersistentMissionOrchestrator`.
No hay cola, daemon, bucle ni calendario adicional. El host debe conservar su
configuración autorizada y PostgreSQL desechable. La configuración actual limita
la ejecución a objetivos sintéticos; no habilita desarrollo general ni producción.

Antes de ejecutar: terminal → no-op; lease vigente → busy/exit 3; lease vencido
→ claim SQL con token nuevo. La decisión preliminar no concede propiedad: SQL usa
`FOR UPDATE SKIP LOCKED`, binding del host, presupuesto de intentos y lease.
Cada checkpoint exige token vigente y versión; el adaptador reconcilia efectos
idempotentes antes de continuar. La cancelación y el presupuesto agotado cierran
la misión. La CLI supervisa pérdida de lease y limita el tiempo dentro del lease.
No borrar filas, resetear versiones o readmitir otra ID para recuperar.

## Después de CI

PLAN Cloud reutiliza `workflow_run` de `Autopilot Core v4`, sin cron nuevo.
Registra SHA, run, resultado y bloqueo en un artefacto de 14 días. No descarga
artefactos ni ejecuta código del SHA disparador bajo el token privilegiado.
CI fallida no autoriza continuación. CI correcta tampoco concede permiso de misión.
El evento solo estará disponible tras integrar el workflow en la rama predeterminada.

**Bloqueo real:** no existe adaptador cloud autorizado para el ledger PostgreSQL
local; el runner Ubuntu no puede usar `127.0.0.1` del PC. No hay configuración de
host cloud, misión admitida cloud ni credencial de alcance mínimo demostradas.
El job falla cerrado con `cloud_ledger_adapter_not_configured`, incluso si existe
OPENAI_API_KEY: una clave de modelo no proporciona persistencia ni autorización.
No se consultaron secretos alojados ni se copiaron credenciales. Localmente no se
detectó OPENAI_API_KEY; esto no prueba ausencia de secretos en GitHub.

El heartbeat histórico `victoriosa-autopilot-6h` se identifica en checkpoints como
local y mediado por Codex; su configuración/runtime no se inspeccionó en vivo aquí.
No fue modificado ni se creó otro scheduler. Por tanto esta entrega prepara una
entrada recuperable, pero **no acredita continuidad desatendida operativa**.

## Validación y reversión

`npm run verify` incluye decisiones de reanudación, recuperación desde checkpoint,
rechazo de checkpoint obsoleto y las pruebas existentes de muerte real de proceso
en selfDevelopment/readinessDevelopment. Esas pruebas no acreditan PostgreSQL
alojado ni ejecución cloud. El resultado local y CI exacta se informan en la PR.
La rama tiene Git deployments deshabilitados en vercel.json.

Rollback: revertir esta PR; las tablas y checkpoints existentes no se alteran.
Siguiente puerta: revisar y proporcionar un adaptador durable cloud con permisos
acotados y demostrar recuperación en dos runners sobre una misma misión autorizada.
Hasta entonces no declarar autonomía después de apagar el PC.
