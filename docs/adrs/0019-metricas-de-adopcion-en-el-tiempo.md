# ADR-0019: Métricas de adopción en el tiempo: la derivada, no el snapshot

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — la fuente de fechas de release merece decisión explícita |
| Relacionado | Principio 2 y 5; `ADR-0011` (D2 append-only, D5, D7, D8, deuda del scan de no-mutación); `ADR-0007` (patrón de asunciones admitidas); `apps/dashboard` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

El panel muestra el estado actual (`report_latest`). La métrica DesignOps
real es la derivada: **time-to-upgrade** (cuántos días tarda una app en
adoptar un release), **% de consumidores en la última versión**, **deuda de
deprecados en el tiempo**. La mitad de los datos ya existe: `submissions` es
append-only por D2 y conserva toda la historia con `generated_at` indexado
(`(repository_id, app_label, generated_at DESC)`). Ninguna query actual la
explota — todas van contra la vista del último reporte.

Esto es el Principio 2 ("evidencia sobre opinión — sin número no está
terminado") aplicado al propio design system: el sistema midiéndose a sí
mismo.

## El gap central, verificado: las fechas de release no existen

Los CHANGELOG de changesets **no llevan fecha** — solo `## x.y.z` + bullets
(verificado en los cuatro paquetes); `parse-changelog.ts` extrae versión y
cambios, cero fechas. "Release X publicado en T1" no está en ninguna fuente
comprometida. Las tres opciones, medidas:

- **`git log` del CHANGELOG**: cualquier invocación de git requiere
  `child_process`, que el gate `no-git-tag-read.test.ts` prohíbe en los dos
  archivos del release log; hacerlo desde un script no cubierto sería evadir
  el gate. Y decisivo: **Vercel clona shallow** — `git log` en build de
  despliegue devuelve historia truncada. Descartada.
- **API de npm** (`time` field): fecha de publish real, pero red en build —
  contra la filosofía D7/D8 (el build no toca red ni base). Aceptable
  únicamente como backfill manual one-shot de las versiones históricas.
- **Fechar hacia adelante** (elegida): un paso post-`changeset version` en el
  workflow de release estampa la fecha bajo cada heading nuevo del CHANGELOG.
  Queda comprometida (inmutable con el Principio 5), cero red, cero
  git-read; `parse-changelog.ts` suma un regex y el gate no se toca. Una sola
  fuente de verdad (Principio 4). Backfill manual de 0.1.0/0.2.0.

El costo honesto: la serie histórica pre-cambio es pobre — pero el proyecto
tiene dos releases; no se pierde nada material. **El costo de esperar sí es
real: cada release sin fecha es un punto de la serie perdido para siempre.**

## Decisión propuesta

### P1. Definiciones exactas de las tres métricas

- `time-to-upgrade(app, X)` = min(`generated_at` donde `dsVersion` ≥ X) −
  fecha de publicación de X. **Solo cuenta `dsVersionSource: installed`**: un
  `declared` puede ser un rango (`^0.2.0`) que no prueba adopción real — se
  excluye o se muestra como señal degradada. Segunda asunción admitida
  (patrón `ADR-0007`): la métrica mide "primer scan que lo vio", no "día del
  upgrade"; el error está acotado por la cadencia de pushes del consumidor.
- `% en última versión` = apps cuyo último reporte tiene `dsVersion` igual a
  la última versión del release log / total de apps con reporte;
  la serie se reconstruye desde las transiciones.
- `deuda de deprecados` = Σ `cardinality(deprecated_components)` por día,
  **solo** filas con `deprecated_components IS NOT NULL` — respetando D5:
  `null` (no miró) se excluye, `[]` (miró, cero) cuenta como 0. Colapsarlos
  rompería el invariante.

Se usa `generated_at` (momento del scan) y no `received_at` (solo auditoría);
la compuerta de monotonicidad RF-AR03 ya garantiza que no retrocede por app.

### P2. Semver se compara en TypeScript, nunca en SQL

Las transiciones salen con
`LAG(ds_version) OVER (PARTITION BY repository_id, app_label ORDER BY generated_at)`
filtrando `IS DISTINCT FROM` — pocas filas. La comparación ≥X y la
reconstrucción de series se hacen en TS: el orden semver **no** es ordenable
como texto en SQL, y con el volumen actual todo cabe en memoria.

### P3. Presentación: tabla server-rendered + sparklines SVG a mano

No hay librería de charting y agregar una contradice el minimalismo probado
del repo (se rechazó hasta una librería de JWT). Un `<svg>` con `<polyline>`
son ~30 líneas, server-renderable, cero dependencias, y pasa los scans D6
(sin form/button/input, sin `dangerouslySetInnerHTML`). Página nueva
`force-dynamic` (D8: lee la base, jamás ISR).

### P4. La cuarta vista paga la deuda diferida de ADR-0011

El seguimiento de `ADR-0011` dice: "el scan de no-mutación enumera tres
componentes conocidos; el disparador para pasar a descubrimiento por glob es
la cuarta vista". **Esta es la cuarta vista.** El PR del panel incluye esa
migración; no es opcional.

### P5. Honestidad con n=1

Hoy reporta **un** consumidor real y hay dos releases: "% en última versión"
es 0% o 100% y time-to-upgrade tiene una muestra. La vista es demo
estructural hasta que haya más consumidores, y el panel debe etiquetar `n`
explícitamente — el Principio 2 prohíbe vestir n=1 de tendencia. No invalida
construir la infraestructura de fechas ya (P0 del plan), porque esperar
pierde datos.

## Plan de implementación (4 PRs ≤400 líneas, ~900–1100 total)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | Fechado de releases: paso en el workflow + regex en `parse-changelog.ts` + backfill 0.1.0/0.2.0 + ajuste de gate/tests | 150–250 |
| 2 | Query builders de serie temporal + tipos + tests de forma SQL | ~200 |
| 3 | Cálculo de métricas en TS (semver compare, reconstrucción, definiciones P1) + tests | 250–300 |
| 4 | Página de métricas: tabla + sparklines SVG + **migración del scan de no-mutación a glob** | 250–350 |

## Alternativas consideradas

**`git log` como fuente de fechas.** Descartada: gate de D7 + shallow clone
de Vercel.

**API de npm en build.** Descartada como dependencia; aceptada como backfill
manual único.

**Librería de charting.** Descartada: contradice el minimalismo del repo y
multiplica la superficie del panel público.

**Snapshot diario materializado.** Innecesario al volumen actual: las
transiciones se reconstruyen en memoria.

## Riesgos

1. La fuente de fechas es decisión ADR-worthy en sí misma — este documento la
   deja elegida (estampado en release-time) para no reabrirla cada vez.
2. Semver en SQL es una trampa conocida — la comparación queda en TS por
   contrato.
3. `declared`-como-rango contamina time-to-upgrade si no se filtra por
   `installed`.
4. La serie temporal convierte la no-poda de D2 de "seguro de auditoría" en
   "feature": una poda futura pasa a romper un producto, no solo un log.
   Registrarlo hace el costo visible.
