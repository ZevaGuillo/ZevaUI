# ADR-0014: Deprecación con fecha de caducidad: gobernanza ejercida, no observada

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — la variante de enforcement exige decisión explícita del maintainer |
| Relacionado | `RF-AR04`, D7 de `ADR-0011` (shape de deprecación); `ADR-0009` D1 y D3 (checkout sin build, `ds-ref`); contrato del tag `v1`; `packages/components/src/registry.ts`, `packages/audit` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

Hoy la deprecación es observación pasiva: el panel "deprecated-in-use" muestra
que alguien usa algo deprecado, y ahí termina. Nadie tiene un incentivo
estructural para migrar. La propuesta agrega caducidad
(`removeIn`) al shape existente `{since, replacement?, note?}` y hace que el
reusable workflow pueda **fallar el CI del consumidor** cuando usa algo
programado para desaparecer — warning primero, error después de la fecha.
La política es del design system; la ejecución ocurre en el repo del
consumidor. Eso es gobernanza ejercida.

## Hallazgo central del análisis: "ambos ya viajan" es solo medio cierto

El reporte viaja, pero **el manifest del DS no viaja**: el workflow
checkoutea el design system en `.zevaui-audit` **sin build** (`ADR-0009` D1:
el escáner son cuatro módulos dependency-free, "un checkout es la
instalación"), y `components.manifest.json` es artefacto de build — no existe
en el checkout `ds-ref`. El único manifest disponible es el **instalado por el
consumidor**, que refleja la política de la versión que instaló, no la
vigente. Un consumidor congelado en una versión vieja jamás vería un
`removeIn` nuevo — y esos son exactamente los que la propuesta quiere empujar.

**Consecuencia de diseño**: la política no puede venir del manifest. Debe
vivir en un artefacto comprometido en el repo — `packages/audit/deprecations.json`
con `{component, since, removeIn, replacement}` — sincronizado con
`registry.ts` por un gate propio en el CI del DS, y leído por el paso de
enforcement desde el checkout `.zevaui-audit`. Mantiene `RF-AR07` (cero red)
y D1 (solo `node:`), y desacopla la política de la versión instalada.

## Decisión propuesta

### P1. `removeIn` es fecha calendario, no semver

- Contra semver: el gate tendría que comparar contra `dsVersion` del reporte,
  que puede ser un **rango declarado** (`^0.1.0`, `dsVersionSource: declared`)
  — incomparable sin un parser semver y sin dependencias. Y si el consumidor
  ya instaló la versión donde el componente se quitó, su build ya falló en
  compilación: el gate llega tarde. Semver-removeIn es redundante con la
  remoción física.
- A favor de fecha: `Date.parse` es dependency-free y determinista, y el
  ratchet warning→error muerde **aunque el consumidor nunca actualice** — que
  es el caso objetivo.
- Costo honesto: el DS no controla cuándo el consumidor corre CI; el rojo
  aparece un día cualquiera sin cambio propio ("CI que se pudre de noche").
  Ese costo es exactamente por qué el enforcement debe ser opt-in, y por qué
  la política escrita debe exigir una ventana mínima de gracia entre `since`
  y `removeIn`.

### P2. Enforcement opt-in; el mandatorio exige `v2`

Tres niveles, con su relación al contrato del tag `v1` ("un breaking del
contrato nunca mueve este tag; crea `v2`"):

| Nivel | Compatibilidad | Decisión |
|---|---|---|
| Warning-only (`::warning::` + step summary) | Aditivo, `v1` se mueve | Siempre activo |
| Opt-in (`enforce-deprecations: false` por defecto) | Corrida byte-idéntica para callers existentes ⇒ `v1` se mueve (patrón `registry-url`/RF-AR06) | **Recomendado** |
| Mandatorio | Rompe corridas existentes sin acción del caller ⇒ breaking ⇒ `v2` | No recomendado ahora |

El mandatorio además contradice frontalmente la tesis del proyecto: la
herramienta de gobernanza no puede violar la regla que existe para imponer
("garantiza que ningún cambio rompa a quien ya lo consume"). El consumidor
**consiente** los dientes; ese consentimiento es parte del diseño, no una
concesión.

### P3. El gate: script dependency-free nuevo, intersección propia

`packages/audit/scripts/assert-deprecations.js` (patrón de
`assert-no-tenant-names.js`): lee el reporte (el contrato "reporte como única
línea de stdout" ya existe), lee `deprecations.json` del checkout, intersecta
**`components[]` directamente** — no `deprecatedComponents` del reporte, que
es `null` sin `node_modules` — y por cada hit: sin `removeIn` o fecha futura ⇒
warning; fecha vencida **y** `enforce-deprecations: true` ⇒ exit 1 con mensaje
que nombra componente, `replacement`, fecha y **procedencia de la política**
(`ds-ref`).

### P4. Enforcement exige pin de `ds-ref`

Con `ds-ref: main` (default de `ADR-0009` D3) la política se mueve sola bajo
el consumidor: `main` deprecia algo y un CI ajeno enrojece sin cambio propio.
El trade de D3 se extiende al enforcement: al optar por `enforce-deprecations`
se recomienda (o exige) pinear `ds-ref` a un tag inmutable.

## Plan de implementación (3 PRs ≤400 líneas, ~600–750 total)

| PR | Contenido | Estimado |
|---|---|---|
| A | `removeIn` en el tipo del registry + tests de passthrough (el spread condicional de `manifest-entry.js` ya propaga el shape entero al manifest con cero cambios) | 100–150 |
| B | `deprecations.json` + gate de sincronía con `registry.ts` en el CI del DS + `assert-deprecations.js` + tests warning/error/fecha | 250–350 |
| C | Input del workflow + paso nuevo + README + verificación byte-idéntica con el consumer-probe + mover el tag `v1` | 150–250 |

La verificación del PR C sigue el precedente medido: default `false` debe
producir una corrida byte-idéntica (RF-UAW14: "designed ≠ verified", pagado
dos veces en la historia de este workflow).

## Alternativas consideradas

**Leer la política del manifest instalado.** Descartada: refleja la versión
vieja del consumidor; los congelados nunca verían la caducidad.

**`removeIn` como versión semver.** Descartada: incomparable contra rangos
declarados sin dependencias, y redundante con la remoción física.

**Enforcement mandatorio.** Descartada por ahora: exige `v2` y contradice la
tesis. Queda registrado como debate abierto de gobernanza.

## Riesgos

1. **Política-en-main**: consumidor opted-in falla sin cambio propio —
   mitigado con pin de `ds-ref` + gracia mínima escrita.
2. **Falsos negativos del escáner** (techo D5 de `ADR-0009`: barrel
   re-exports, `import()` dinámico, namespace imports contribuyen cero): un
   consumidor puede usar un deprecado vía re-export y pasar verde. El verde
   del enforcement no prueba limpieza; documentarlo.
3. **Doble procedencia** (manifest instalado alimenta el panel;
   `deprecations.json` alimenta el gate): pueden divergir — el mensaje de
   error declara siempre su fuente.
4. El reporte **no** necesita llevar metadata de enforcement; agregarla
   activaría el esquema cerrado (`ALLOWED_KEYS`) + ingesta + panel. Evitarlo.
