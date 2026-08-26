# ADR-0016: Conformance del consumidor: la mitad que faltaba de RF-04

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | `RF-04`, `RNF-07`, `RNF-08`; `ADR-0009` (reusable workflow, checkout dependency-free); `ADR-0015` (pasada CSS compartida); gate G1 de `packages/components`; `packages/config/src/gate-harness.js` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

El contrato hoy apunta en una sola dirección: el design system promete no
romper. Pero el consumidor puede romperse solo — importar los stylesheets en
el orden equivocado (el README de `components` lo advierte explícitamente),
hardcodear hex donde debería haber tokens, sobreescribir `.zui-button` desde
CSS externo. Ninguna de esas roturas es culpa del DS, y ninguna es visible
hoy.

`RF-04` de la constitución exige "impedir valores de estilo literales en los
consumidores (verificado por lint/grep en CI)" — y hoy solo se cumple **dentro
del design system** (gate G1 sobre el output de Panda). Esta propuesta es la
mitad consumidor de ese mandato: una suite que el consumidor corre contra su
app y le dice qué está haciendo mal. "Aquí está el contrato" pasa a "aquí está
el contrato y el verificador".

## Decisión propuesta

### P1. Catálogo de reglas v1 — solo lo verificable estáticamente

1. **Orden de stylesheets**: `@zevaui/tokens/styles.css` debe importarse antes
   que `@zevaui/components/styles.css`. `scan-source.js` ya parsea side-effect
   imports en orden de offset, pero `TRACKED_SPECIFIERS` filtra por igualdad
   exacta y descarta los subpaths `/styles.css` — hay que admitirlos. Regla:
   mismo archivo con orden invertido = hallazgo; `components.css` importado
   sin `tokens.css` en ningún archivo = hallazgo. El orden **cross-archivo**
   no es decidible estáticamente (depende del grafo de módulos y el bundler
   puede reordenar chunks CSS) ⇒ esa parte es advisory, nunca bloqueante.
2. **Selectores `.zui-*` sobreescritos**: CSS del consumidor que targetea
   clases `.zui-*` es violación — los componentes tipan `className`/`style`
   como `never`, así que CSS externo es la única vía de bypass. Distinción
   clave para el falso positivo: sobreescribir custom properties `--zui-*` es
   el mecanismo de theming **oficial** ("override `--zui-*`, never fork") —
   la regla matchea solo selectores de clase, jamás declaraciones de
   variables.
3. **Hex/literales donde debería haber `var(--zui-*)`**: la más alineada con
   `RF-04` y la de mayor falso positivo — el consumidor es dueño legítimo de
   su UI no-DS. v1: severidad warn/report-only, jamás error por defecto, y
   heurística acotada a contexto DS (literales dentro de reglas que también
   referencian `--zui-*` o `.zui-*`).

Fuera de alcance v1 (requieren runtime/DOM): orden efectivo en la página
construida, especificidad computada, CSS-in-JS emitido, estilos inline.

### P2. Entrega: extensión del reusable workflow, no paquete npm

Precedente explícito: `@zevaui/audit` es privado y no publicado — el workflow
checkoutea el DS en `.zevaui-audit` sin `pnpm install` ("un checkout es todo
el install"), blindado por el gate no-network (RF-AR07). Publicar a npm
contradiría esa postura y agregaría superficie de release; `RNF-07` ya lo
satisface el consumo vía `uses: ...@v1` con `ds-ref`.

Diseño v1: input opt-in nuevo en `audit-ds-usage.yml` —
`conformance: "" | "warn" | "error"`, default `""` = corrida byte-idéntica a
la actual (mismo patrón `registry-url`/RF-AR06, misma razón: el contrato del
tag `v1`). El código puede vivir dentro de `packages/audit` (comparten el
walker; menos superficie) o como `packages/conformance` privado. La variante
npm (para `npx` local) queda como v2 si aparece demanda real.

### P3. Cada regla nace con dientes probados

`gate-harness.js` ya codifica la mecánica "prove the gate has teeth"
(exit≠0 <126 = PASS, 0 = FAIL, crash = FAIL distinto): cada regla de
conformance lleva su fixture rota + teeth test, como todos los gates del repo.

### P4. Registry: v1 solo local

Hallazgos como artifact + step summary. El esquema del reporte es cerrado
(`ALLOWED_KEYS`): un campo `conformance` desconocido haría que la ingesta
**rechace el reporte entero** de quien opte — la lección ya pagada. Si algún
día se reporta al registro: campo aditivo acotado
(`{rulesVersion, findings: [{rule, count}]}`), desplegando esquema+API
primero y emisión después, en PRs separados.

## Plan de implementación (4–5 PRs ≤400 líneas, ~1200–1600 total)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | `scan-css.js` (blanker CSS + selectores/declaraciones) + tests — **slice compartido con `ADR-0015`** | 300–350 |
| 2 | Walker parametrizado por extensión + reglas orden-de-imports y `.zui-*` override + fixtures | 350–400 |
| 3 | Regla de literales con severidad configurable + teeth tests | 250–300 |
| 4 | Input del workflow + step summary + README | 200–300 |
| 5 | (Diferido) campo del registry: esquema → API → emisión | 150–250 |

## Alternativas consideradas

**Paquete npm publicado con CLI.** Descartada para v1: contradice el
precedente del audit y multiplica superficie; reconsiderar solo con demanda
de runs locales.

**Reglas bloqueantes por defecto.** Descartada: la regla de hex opina sobre
código que el consumidor posee; default no-bloqueante y opt-in a `error` —
la misma postura de consentimiento que `ADR-0014`.

**Fusionar con `ADR-0015` en una sola propuesta.** Descartada: comparten
infraestructura (la pasada CSS), no reglas ni destino de los datos.

## Riesgos

1. **Falsos positivos rompiendo CI ajeno** — la misma tensión de gobernanza
   de `ADR-0014`; mitigación estructural: default no-bloqueante, opt-in.
2. La regla de orden es advisory por diseño (el bundler puede reordenar).
3. La regla de hex debe permanecer contextual a zonas DS o el verificador
   pierde legitimidad.
4. Drift del catálogo de reglas entre versiones — se hereda la solución de
   `ADR-0009` D3: `ds-ref` pineado.
5. El escaneo de CSS presiona el cap de 20 000 archivos (menor).
