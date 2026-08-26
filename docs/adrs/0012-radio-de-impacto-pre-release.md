# ADR-0012: Radio de impacto pre-release: cruzar el registro de adopción con el manifest antes de publicar

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | `RF-20` (contract testing, sin implementar); `O1`, `O4`; `ADR-0011` (registro de adopción, D8, D9); `ADR-0001` D8 (manifest); `packages/components`, `packages/audit`, `apps/dashboard` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido. Se documenta para que la decisión, sus
> límites medidos y sus riesgos no se pierdan hasta que se programe.

## Contexto: qué problema busca resolver

El registro de adopción responde `O4` ("¿qué versión usa cada app?") y ahí
termina: es un panel pasivo que detecta la ruptura **después** de publicar,
mirando quién quedó atrás. Pero la tesis del proyecto — "garantiza que ningún
cambio rompa a quien ya lo consume" — pide detectarla **antes**.

Las dos fuentes de verdad para hacerlo ya existen:

- El registro sabe qué componentes importa cada consumidor (`submissions.components`,
  vista `report_latest`, lecturas públicas por GET sin autenticación — `ADR-0011` D4).
- `components.manifest.json` sabe cuál es el contrato de cada componente
  (slots, variants con axis/values/default, tokens consumidos, deprecación) —
  generado post-build desde `dist`, nunca desde el fuente (`ADR-0001` D8).

Lo que falta es el cruce: ante un PR con un cambio breaking, un comentario
automático que diga "este cambio afecta a N apps conocidas". Eso convierte el
registro de observatorio en insumo de la decisión de release, y es la
materialización directa de `RF-20`, que hoy es el único requisito funcional
sin una línea de código.

## Límite medido: "N call sites" no es posible hoy

El análisis contra el código real corrigió la ambición original. El scanner
(`packages/audit/scripts/scan-source.js`) reporta **solo nombres de
componentes importados**: `scanSource` devuelve `{specifier, names}` y
`buildReport` colapsa a un set ordenado. No hay conteo por archivo, no hay
call sites, no hay props.

La promesa honesta en fase 1 es **"afecta a 3 apps"** (nivel componente).
"14 call sites" exige una fase 2 que extienda el scanner.

Segundo límite: el manifest modela el contrato de *recipes* (variants, slots,
tokens), **no la superficie completa de props TypeScript**. "Dialog.size"
funciona porque `size` es un variant axis; el rename de una prop que no es
variant es invisible al diff. El comentario del PR debe declarar ese alcance.

## Decisión propuesta

### P1. El diff de manifest es la detección de breaking

Un módulo puro compara el manifest **publicado en npm** (viaja en el tarball
como subpath export real; inmutable por Principio 5) contra el manifest
construido en el PR. Clasificación breaking: componente eliminado, axis de
variant eliminado, value de variant eliminado, default cambiado, slot
eliminado. `deprecated` agregado es notable, no breaking. Se elige npm y no
git tags como fuente del "publicado" porque `ADR-0011` D7 ya desconfía de los
tags por mutables.

### P2. El gate vive en el CI de PR del design system, y es advisory

Job nuevo en el CI de PR (no en `release.yml`, que corre en push a `main`
cuando ya es tarde). Disparadores: changeset con bump major en el PR, o diff
de manifest con entradas breaking. Pasos: build → build-manifest → fetch del
manifest npm → diff → si hay breaking: `GET /api/v1/reports` (público, sin
auth) → intersección de `components[]` por app → comentario en el PR
(`permissions: pull-requests: write` acotado al job).

**Advisory, nunca bloqueante.** Bloquear el release sobre el registro
reintroduce exactamente el acoplamiento que `ADR-0011` D8 eliminó: una base
Neon con autosuspend en el camino crítico. Registro caído → comentario
"radio de impacto desconocido, registro no disponible", nunca PR bloqueado.
Si algún día se quiere bloquear, el fallback es el dump estático de
`export:registry` (D9) comprometido como caché.

### P3. El comentario declara sus propios límites

Cada comentario incluye: apps afectadas, `dsVersion` que cada una reporta
(una app clavada en 0.x no se rompe hasta que suba), edad del reporte
(`generated_at`) y cobertura explícita — "de los consumidores que reportan",
porque el registro es opt-in y "afecta a 3 apps" es cota inferior. Omitirlo
sería mentir por omisión (Principio 2).

### P4. Fase 2: granularidad de call sites, aditiva y con orden de deploy

Para llegar a "N call sites": (a) escaneo JSX sobre el texto saneado — la
infraestructura de blanking con offsets preservados ya lo hace factible sin
AST; los spread props (`{...p}`) son invisibles y el reporte debe declararlo
con un flag para no mentir; (b) campo aditivo opcional
`usage: { [componente]: { callSites, props[] } }` siguiendo el molde exacto de
`deprecatedComponents` (RF-AR05).

**Orden de deploy obligatorio: registro primero, scanner después.** El
validador compartido (`report-schema.js`) rechaza claves desconocidas, y
`submit-report.js` es always-exit-0: un scanner nuevo contra un registro
viejo produce un 400 que fire-and-tolerate convierte en warning — el dato se
pierde **en silencio**. Es la generalización de la lección pagada con el tag
`v1`: lo diseñado no es lo verificado, y un run verde no prueba una
escritura.

En la base: columna `usage jsonb` nullable vía migración 0002 con el runner
de D11 (`CREATE OR REPLACE VIEW` no viola el append-only: no hay `UPDATE` ni
`DELETE` de datos). `NULL` = "reportado por scanner viejo", mismo patrón
null-vs-valor de D5.

## Plan de implementación (PRs ≤400 líneas)

| PR | Contenido | Estimado |
|---|---|---|
| A | Módulo puro de diff de manifest + clasificación breaking + tests | 250–350 |
| B | Script de radio de impacto (fetch npm + GET registro + comentario, fire-and-tolerate) + fixtures | 300–400 |
| C | Wiring del workflow de PR + gate de permisos (patrón `workflow-permissions-gate.test.ts`) | 150–250 |
| D–F | Fase 2: escaneo JSX + campo `usage` + migración 0002 + serializer + panel | 3 PRs más |

Fase 1 es entregable sola y valiosa por sí misma.

## Alternativas consideradas

**Gate bloqueante desde el día uno.** Descartada: acopla el pipeline de
release a una base con autosuspend (la lección de D8) y castiga con datos
opt-in potencialmente viejos. Se endurece con datos, no por diseño.

**Leer el "publicado" desde git tags.** Descartada: tags mutables, la misma
razón por la que el release log sale de los CHANGELOG (D7).

**Prometer call sites en fase 1.** Descartada: los datos no existen en el
registro. Prometer más de lo que el diff ve viola el Principio 2.

## Riesgos

1. **Mayor**: Neon free tier con autosuspend como dependencia del camino de
   release — mitigado por advisory + fallback D9.
2. Skew de versiones del validador entre scanner e ingesta — mitigado por el
   orden de deploy registro-primero; el 400 se pierde en silencio si se
   invierte.
3. Cobertura opt-in: el número es cota inferior y el comentario debe decirlo.
4. Reportes viejos: mostrar `generated_at` siempre.

## Decisiones abiertas al programar

- ¿El diff usa npm `latest` o la versión que cada app reporta en `dsVersion`
  (radio de impacto por-app, más preciso)?
- ¿Fase 2 se justifica antes de tener más de dos consumidores reales?
- ¿El gate verifica además que el major traiga guía de migración (O3), como
  sinergia con `ADR-0013`?
