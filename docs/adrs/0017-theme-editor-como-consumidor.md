# ADR-0017: Theme editor como app consumidora: hacer visible validateTheme

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | `O6`, `RF-17`, `RNF-08`, §4 Límites de `CONSTITUTION.md`; `ADR-0010` (pares no textuales); `ADR-0003` (MCP `validate_theme`); `ADR-0020` (`propose_theme` como seed); `packages/constraints`, `packages/tokens`, `packages/components` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

La constitución dice que la administración multi-tenant es responsabilidad de
la aplicación consumidora, no del design system (§4, `RNF-08`). Correcto
arquitectónicamente — con un efecto lateral: **nadie puede ver
`validateTheme` funcionando**, que es la pieza más original del proyecto.
Vive en tests y en una tool MCP; no existe ningún lugar donde un humano vea
un tema rechazado en tiempo real con el par exacto y el ratio.

El hallazgo del análisis es que esto **no es una idea nueva**: la propia
constitución ya nombra el artefacto. `O6`: *"un tema de tenant que rompe
contraste se rechaza antes de guardarse — validador del design system
aplicado en el theme editor de la app"*. `RF-17` lo repite. La propuesta es
construir esa app consumidora de referencia: pickers de color, preview en
vivo con los 6 componentes, y `validateTheme` rechazando en tiempo real.

Mata tres pájaros: demuestra la tesis, resuelve el dogfooding, y da un
consumidor más para el registro.

## Evidencia del código que sostiene el diseño

- `validateTheme({id, colors}) → {pass, violations[]}` donde
  `Violation = {rule, tokens, expected, actual, message}`: para
  `low-contrast`, `tokens` es **el par exacto** y `actual` el ratio con dos
  decimales. **El contrato ya expone todo lo que la UI necesita** para el
  rechazo en vivo — aunque como strings preformateados, no números.
- El contrato (v1.1.0): 16 pares de texto (piso 4.5, o 7.0 en high-contrast)
  + 5 pares no textuales WCAG 1.4.11 a piso 3.0 (`ADR-0010`). ~21 tokens de
  color requeridos.
- `parseColor` acepta **solo** hex (#3/#6) y `oklch(L C H)`. El
  `<input type="color">` nativo emite hex ⇒ compatible; pickers custom deben
  restringir formato o todo será `invalid-color`.
- Inyección de tema en runtime = setear `--zui-color-*` inline sobre un
  wrapper del preview: funciona **por diseño** del puente Panda
  `--zuip-* : var(--zui-*)`.
- **Gap real de exports**: el index de `@zevaui/constraints` exporta solo
  `validateTheme` y tipos. `contract`, `requiredTokens`,
  `minContrastRatioFor` y `contrastRatio` son internos — enumerar pares
  proactivamente o mostrar medidores de ratio en vivo exige un PR chico
  ampliando exports. La demo mínima honesta funciona solo con `violations`.
- El MCP ya expone `validate_theme` con shape `{theme, colors}` — el editor
  debe importar/exportar en ese mismo shape para cerrar el loop.

## Decisión propuesta

### P1. `apps/theme-editor` en el monorepo, no repo externo

El argumento "consumidor npm real" ya está cubierto por
`zevaui-consumer-probe` (externo, corrida verificada); duplicarlo aporta
poco. El monorepo da dogfooding directo con `workspace:*`, CI y deploy
existentes, y cero drift de versiones. Un espejo externo consumiendo desde
npm queda como opción futura si se quiere un segundo probe.

### P2. SPA client-side pura, sin backend

Vite + React (precedente: storybook; el stack de dashboard/Next sería
overkill — su backend existe por el registro, no por UI). Sin backend =
cumple el Límite constitucional por construcción. `validateTheme` es síncrono
y trivial (~21 parses + 21 pares): se corre en el hilo principal on-change;
un worker es sobre-ingeniería.

### P3. La línea dura contra el scope creep

Cero persistencia server-side, cero noción de tenant, cero auth. Export a
JSON/clipboard es el tope (localStorage de borrador aceptable). "Tenant →
tema" y la creación de tenants quedan en el repo de cada aplicación
consumidora — la tabla de responsabilidades de la constitución no se
renegocia por conveniencia de la demo.

### P4. El editor reporta al registro como cualquier consumidor

Self-invocation del reusable workflow igual que el job `audit-self` de
`ci.yml`, con `working-directory: apps/theme-editor` y `app` explícito (D3
exige `app` cuando working-directory es subdirectorio). El identificador de
la app va al denylist de tenant-names del dashboard, nunca bajo `packages/*`
(RF-AR08).

## Plan de implementación (5–6 PRs ≤400 líneas, ~1300–1500 total)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | Scaffold de la app + wiring CI | ~250 |
| 2 | Exports de constraints (`contract`, `requiredTokens`, `minContrastRatioFor`, `contrastRatio`) + tests | ~100 |
| 3 | Estado del editor + pickers agrupados por rol + selector de tema base | ~350 |
| 4 | Preview con los 6 componentes + inyección de CSS vars | ~300 |
| 5 | Panel de violaciones + export JSON `{theme, colors}` con botón deshabilitado si `!pass` | ~250 |
| 6 | (Opcional) registro/deploy | ~100 |

## Alternativas consideradas

**Repo externo consumiendo desde npm.** Descartada para v1: el probe externo
ya existe; el costo de drift y de un segundo pipeline supera el beneficio.

**Next en vez de Vite.** Descartada: no hay backend que justifique Next; el
precedente liviano es storybook.

**Web worker para la validación.** Descartada: el cómputo es trivial y
síncrono.

**Duplicar el contrato en la UI** en vez de exportar. Descartada: drift
garantizado; preferir el PR de exports.

## Riesgos

1. **Scope creep hacia admin multi-tenant** — prohibido por `RNF-08`; la
   línea dura de P3 es el mecanismo de contención y debe estar en el README
   de la app.
2. Formatos de color: pickers restringidos a hex/oklch o todo es
   `invalid-color`.
3. `actual` es string de dos decimales: si la UI quiere barras de precisión,
   exportar `contrastRatio` (PR 2), no re-parsear el mensaje.

## Sinergias

Es el prerequisito visual de `ADR-0020` (`propose_theme`): un tema propuesto
por el MCP se importa directo al editor para verlo en vivo, y el editor
exporta en el shape que `validate_theme` ya acepta. Cierra además el hueco
narrativo del proyecto: la pieza más original por fin es observable.
