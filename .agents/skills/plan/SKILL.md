---
name: plan
description: 'Objetivo: convertir el código existente de Victoriosas Autopilot en una plataforma operativa, verificable y recuperable, capaz de atender consultas, coordinar agentes, desarrollar mejoras, supervisar infraestructura y gestionar tareas comerciales autorizadas, con mínima intervención humana en las operaciones de bajo riesgo.'
---

# Plan maestro de culminación de Victoriosas Autopilot

Hoja de ruta propuesta · 11/11/2026

Objetivo: convertir el código existente de Victoriosas Autopilot en una plataforma operativa, verificable y recuperable, capaz de atender consultas, coordinar agentes, desarrollar mejoras, supervisar infraestructura y gestionar tareas comerciales autorizadas, con mínima intervención humana en las operaciones de bajo riesgo.

No propongo reconstruir el sistema. Propongo terminar, integrar, probar y activar progresivamente sus capacidades existentes, conservando la identidad profesional de Victoriosas.

## 1. Vista general del programa

12 frentes de culminación

Prioridades propuestas

01

Inventario, reconciliación y arquitectura

Base

02

Motor de agentes y misiones

Núcleo

03

Consultas y conocimiento profesional

Producto

04

IA y guardián de respuestas

Producto

05

Administración, permisos y auditoría

Control

06

Comunicaciones y seguimiento

Canales

07

Autodesarrollo con Codex

Ingeniería

08

Continuidad, recuperación y operación cloud

Operación

09

Seguridad y observabilidad

Operación

10

Informes, campañas y analítica

Crecimiento

11

Motores comerciales y abastecimiento

Opcional

12

Motor extensible multiempresa

Futuro

Ruta prioritaria

Desarrollo posterior

Activación condicionada

Los doce frentes pueden agruparse en seis etapas de entrega. No deben ejecutarse todos a la vez: las dependencias del núcleo y la seguridad determinan el orden.

## 2. Fases y resultados verificables

## I

Fundamentos y reconciliación

Unificar el inventario técnico y el estado real de GitHub, PR, CI, Vercel, Supabase, equipo Windows y agentes. Identificar código duplicado, módulos abandonados, integraciones incompletas y funciones que solo existen en laboratorio.

Salida: una matriz por módulo con `DEFINIDO`, `PROBADO`, `FUSIONADO`, `DESPLEGADO`, `EJECUTADO` o `BLOQUEADO`; dependencias y prioridad documentadas.

## II

Núcleo operativo confiable

Consolidar los seis agentes, colas persistentes, estados de misión, reintentos, recuperación tras interrupción, autenticación, permisos, panel de control y auditoría.

Salida: misiones de prueba capaces de sobrevivir a una interrupción y continuar desde el último checkpoint válido, sin repetir efectos ni aceptar ejecutores obsoletos.

## III

Atención inteligente de Victoriosas

Culminar la biblioteca de consultas, hechos profesionales aprobados, generación fundamentada, guardián determinista, bandeja privada, consentimiento y respuesta supervisada. Integrar las PR #225–#227 según sus dependencias y añadir la interfaz administrativa del ciclo D.

Salida: un caso controlado completo, desde el formulario hasta la entrega autorizada, con pruebas negativas de caducidad, revocación, permisos y deduplicación.

## IV

Autodesarrollo y continuidad

Integrar el circuito de detección de deficiencias, planificación, worktrees aislados, ejecución Codex, regresiones, revisión adversarial, preparación de PR y recuperación del lanzador Windows ORD-204G. Después, demostrar un disparador cloud independiente del PC.

Salida: una corrección técnica real de bajo riesgo, reversible y auditada, más una recuperación verificada tras fallo del ejecutor.

## V

Omnicanal, informes y autonomía acotada

Incorporar progresivamente correo, WhatsApp Business y Meta mediante APIs oficiales. Implementar preferencias, baja de seguimiento, campañas revisadas, agenda orientativa, métricas, alertas y niveles N0–N4 de autonomía.

Salida: canales autorizados con eventos verificables, control de duplicados, límites de costo y apagado inmediato.

## VI

Capacidades comerciales y expansión

Conservar y completar como subsistemas independientes los motores de búsqueda de proveedores, evidencia de mercado, oportunidades, precios, borradores y consejos de aprobación. Evaluar después la extracción de un motor multiempresa con aislamiento de clientes.

Salida: pruebas comerciales aisladas y una decisión explícita de activación o separación; nunca publicación, compras ni cobros por defecto.

## 3. Dependencias críticas

Secuencia de integración

Los desarrollos independientes pueden prepararse en paralelo, pero su integración y activación deben respetar estos controles.

## 4. Criterios obligatorios de culminación

Ninguna faceta se considerará terminada solamente porque existe un archivo, una prueba unitaria o una PR aprobada.

Puerta de calidad por módulo

0 de 8

Implementación integrada sin duplicar componentes existentes

Pruebas unitarias, integración, seguridad y regresiones aprobadas

CI validate y postgres aprobadas para el SHA exacto

Permisos, RLS, consentimiento y separación de entornos comprobados

Recuperación, idempotencia, concurrencia y fallos de red comprobados

Presupuesto y consumo externo medidos; sin gastos no autorizados

Despliegue autorizado y prueba real del recorrido operativo

Observabilidad, alertas, rollback y documentación actualizados

Lista interactiva para evaluar un módulo. No representa pruebas ejecutadas ni actualiza el repositorio.

## 5. Orden inmediato de las misiones Codex

| Orden | Misión                            | Entregable                                                    |
| ----- | --------------------------------- | ------------------------------------------------------------- |
| P0    | Auditoría de integración y estado | Matriz de capacidades y PR pendientes                         |
| P1    | Cerrar cadena de consultas A–D    | Biblioteca, compositor, persistencia, interfaz administrativa |
| P2    | Consolidar misiones persistentes  | Cola y recuperación demostradas                               |
| P3    | Cerrar ORD-204G                   | Recuperación Windows probada                                  |
| P4    | Consolidar autodesarrollo         | Corrección real auditada mediante Codex                       |
| P5    | Integrar recepción supervisada    | Recorrido completo probado                                    |
| P6    | Activar canales autorizados       | Correo y mensajería controlados                               |
| P7    | Observabilidad y autonomía N0–N4  | Operación acotada medible                                     |
| P8    | Evaluar comercio y multiempresa   | Decisión arquitectónica independiente                         |

La numeración indica prioridad de coordinación, no autoriza saltarse las fases F0–F8 definidas en `docs/PROJECT_DIRECTION.md`.

## 6. Directiva maestra para Codex

Este es el prompt que utilizaría como misión de planificación y coordinación, no como autorización para desplegar todo de una sola vez.

# CODEX — PLAN MAESTRO DE CULMINACIÓN DE VICTORIOSAS AUTOPILOT

**Rol:** Principal Engineer / Arquitecto de Sistemas Multiagente / SRE / Director Técnico

**Repositorio:** `Victoriosas/autopilot`

**Objetivo general:** Culminar integralmente Victoriosas Autopilot, aprovechando al máximo los módulos ya implementados y conservando su dirección oficial, seguridad, trazabilidad y capacidad de recuperación.

## 1. Inspección obligatoria

Leer `AGENTS.md`, `docs/PROJECT_DIRECTION.md`, `docs/AUTOPILOT_STATE.md`, las directivas vigentes, el checkpoint actual y las habilidades de Codex pertinentes.

Comprobar:

- SHA de main, ramas y PR abiertas, dependencias y CI por commit.
- Worktrees locales, archivos sin seguimiento, procesos y escritores activos.
- Estado verificable de Node, Vercel, Supabase, Windows Task Scheduler y agentes conectados.
- Estado de los ciclos A, B, C y D de consultas.
- Estado de ORD-204G y del autodesarrollo de Autopilot.
- Integraciones reales frente a simuladores y código de laboratorio.

No confundir código definido con despliegue o ejecución. No deducir inactividad de la ausencia de commits.

## 2. Crear un mapa integral de capacidades

Auditar `src/autopilot` y sus dependencias en el resto del repositorio.

Clasificar cada módulo como DEFINIDO, PROBADO, FUSIONADO, DESPLEGADO, EJECUTADO o BLOQUEADO.

Registrar para cada módulo:

- Responsabilidad y dependencias.
- Funcionalidad real y faltante.
- Tests, cobertura y fallos.
- Superficie de seguridad.
- Costos y configuración.
- Evidencia reproducible.
- Prioridad, reversibilidad y criterio de finalización.

## 3. Plan por frentes

A. Arquitectura, calidad y eliminación de duplicaciones.

B. Motor de seis agentes, persistencia de misiones, leases, fencing, checkpoint y recuperación.

C. Conocimiento profesional aprobado, consultas y guardián determinista.

D. API y panel administrativo, JWT, RLS, auditoría, revocación y purga.

E. Integración supervisada con canales autorizados y deduplicación de entregas.

F. Desarrollo autónomo gobernado mediante Codex, PR, pruebas y revisión externa.

G. Recuperación Windows ORD-204G, observabilidad y continuidad cloud independiente del PC.

H. Informes, métricas, alertas, costos y niveles graduados de autonomía.

I. Subsistemas comerciales aislados: proveedores, oportunidades, precios, borradores y aprobaciones.

J. Evaluación futura de arquitectura multiempresa sin iniciar otro producto prematuramente.

## 4. Método de ejecución

1. Priorizar la fase más temprana bloqueada de la dirección oficial.
2. Reutilizar PR y trabajo existente antes de crear nuevas ramas.
3. Asignar una misión acotada a un único escritor por superficie de archivos.
4. Utilizar worktree exclusivo, presupuesto explícito y permisos mínimos.
5. Implementar cambios pequeños, reversibles y comprobables.
6. Ejecutar pruebas, revisión adversarial y escaneo de secretos.
7. Preparar PR, verificar CI del SHA final y documentar resultados.
8. Mantener checkpoint durable, con evidencia, blockers y próxima misión.
9. Repetir únicamente con titularidad e aislamiento confirmados.

Codex es el ejecutor principal. No activar OpenCode ni agentes alternativos sobre los mismos archivos. Reutilizar el heartbeat existente y evitar schedulers duplicados.

## 5. Restricciones permanentes

- Sin credenciales ni datos personales en código, prompts, informes o registros.
- Sin compras, cobros, publicación comercial, campañas, migraciones alojadas, fusiones ni despliegues no autorizados.
- Mantener `no_send` en consultas hasta que una política explícita permita una entrega concreta y se hayan comprobado sus condiciones.
- No diagnosticar, inventar tratamientos, precios ni disponibilidad.
- Preservar cambios ajenos y evitar comandos Git destructivos.
- No afirmar continuidad autónoma sin evidencias del runtime.
- Separar pruebas sintéticas de verificaciones reales.

## 6. Entregables

Crear o actualizar en la rama de trabajo:

- `docs/AUTOPILOT_MASTER_COMPLETION_PLAN.md`
- `docs/AUTOPILOT_CAPABILITY_MATRIX.md`
- `docs/AUTOPILOT_DEPENDENCY_GRAPH.md`
- `docs/AUTOPILOT_ACCEPTANCE_GATES.md`
- `docs/AUTOPILOT_STATE.md`

Producir un backlog ordenado por fase con criterios de aceptación, dependencias, riesgos, esfuerzo estimado, evidencia y ruta de rollback.

## 7. Primer ciclo

Comenzar por investigación y reconciliación de las PR existentes, especialmente #225, #226, #227 y el desarrollo administrativo D.

Si se detecta un escritor activo o una entrega incierta, no iniciar otra modificación concurrente. Registrar la situación y continuar solamente con investigación independiente.

Entregar un informe ejecutivo, la matriz de capacidades, el plan de integración y la siguiente misión concreta lista para Codex.

**Condición de éxito:** avanzar hacia un Autopilot integral mediante entregas verificadas, sin degradar la atención profesional, la seguridad ni la continuidad existente.

## 7. Resultado final al que debemos llegar

La culminación del proyecto debería producir tres capacidades diferenciadas:

Victoriosas profesional

Una plataforma que recibe, organiza, prepara y coordina la atención de clientas con información aprobada, supervisión adecuada y comunicaciones trazables.

Autopilot operativo

Una oficina de agentes que ejecuta tareas autorizadas, conserva su estado, informa problemas, se recupera de fallos y funciona con supervisión medible.

Autopilot extensible

Un núcleo modular capaz de incorporar herramientas comerciales y, cuando corresponda, evolucionar hacia un producto multiempresa sin comprometer los datos de Victoriosas.

Mi recomendación es comenzar con P0 y P1: consolidar el estado real y culminar la cadena de consultas A–D. Son los pasos que más acercan el proyecto a prestar un servicio completo, en lugar de seguir acumulando módulos independientes.

Este plan es una propuesta de ejecución basada en el código y la dirección del proyecto inspeccionados; aún no se ha registrado en el repositorio ni se ha ejecutado ninguna misión nueva.
