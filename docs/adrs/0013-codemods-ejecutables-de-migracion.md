# ADR-0013: Codemods ejecutables: la guía de migración que se corre, no que se lee

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | Principio 5, `RF-09`, `O3`; `ADR-0009` D1 (contrato dependency-free del audit); `packages/audit/__fixtures__/consumer`; `.changeset/config.json` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

El Principio 5 y `RF-09` exigen que todo breaking change incluya guía de
migración. Una guía en prosa es un documento que nadie lee y que nadie
verifica: puede estar mal y nada se pone rojo. La propuesta la convierte en
artefacto ejecutable:

```
npx @zevaui/migrate 0.x-to-1.0
```

con la parte que la hace defendible: el codemod se testea en CI contra el
fixture consumer existente. Se aplica al fixture, se typecheckea, y el gate
falla si el codemod no dejó al consumidor compilando. La guía deja de ser
opinión y pasa a ser evidencia (Principio 2).

## Hallazgos del código real que condicionan el diseño

1. **El fixture consumer hoy no compila, a propósito.** Son 6 archivos
   (~90 líneas) deliberadamente fuera del workspace pnpm, sin tsconfig y sin
   `node_modules`, diseñados como fixture *adversarial del escáner*
   (RF-UAW03..06): importan un paquete inexistente, CSS, JSON y `.mdx`.
   **Precondición dura**: antes de cualquier codemod hace falta un harness que
   lo vuelva typecheckeable (tsconfig generado con los paths de
   `tsconfig.base.json`, ambient `.d.ts` para css/json/paquete externo,
   exclusión de `.mdx`) y un **pre-gate** que typecheckee el fixture SIN
   migrar. Sin ese pre-gate, "el codemod lo dejó compilando" es infalsificable.

2. **El CI ya muta el árbol del fixture en runtime**: `audit:gate` planta y
   quita decoys bajo `__fixtures__/consumer/node_modules` (RF-UAW12). El gate
   de codemods debe operar sobre una **copia en temp** (`RUNNER_TEMP`), nunca
   in-place.

3. **El contrato dependency-free no aplica aquí.** `ADR-0009` D1 lo impone a
   `@zevaui/audit` porque el reusable workflow corre desde un checkout en CI
   ajeno y jamás debe ejecutar el lockfile de un consumidor. `@zevaui/migrate`
   corre vía `npx` en la máquina del consumidor: puede usar dependencias.
   El reusable workflow, en cambio, **jamás debe ejecutar migrate**.

4. **No hay breaking changes publicados.** Todo está en 0.2.0. No existe la
   transición real contra la cual escribir el primer codemod.

## Decisión propuesta

### P1. ts-morph como motor de reescritura

El lexer de `scan-source.js` (blanking con offsets) es un **localizador**, no
un reescritor: sin AST, sin printer, sin JSX. Serviría solo para renombres de
specifier por splicing y acoplaría un paquete público a scripts privados del
audit. Entre las herramientas reales: `ts-morph@28` ya está resuelto en el
lockfile (transitivo vía Panda CSS), su API TypeScript es la mejor y el
codebase es TS-first. `jscodeshift` (con recast) preserva mejor el formato
del código no tocado pero su ergonomía TS es mediocre. Se elige **ts-morph**
con tests de snapshot de diff para vigilar el churn de formato; jscodeshift
queda como alternativa válida si la preservación de formato en código ajeno
se vuelve prioritaria.

### P2. El gate: copia en temp, pre-gate, y assert de contenido

Paso raw en `ci.yml` (precedente: `audit:gate`, que también muta árboles):

1. Copiar el fixture a temp.
2. **Pre-gate**: typecheck del fixture sin migrar contra la API 0.x.
3. Aplicar el codemod.
4. Typecheck con el tsconfig-harness generado.
5. **Assert de contenido**: diff contra un fixture-esperado-migrado
   comprometido. El typecheck solo es un oráculo débil — un codemod que borra
   código también compila. El repo ya tiene este patrón en
   `expected-report.json`.

### P3. El harness nace ahora; el paquete se publica con el primer breaking real

Publicar `@zevaui/migrate` vacío contradice la cultura del repo ("gate checks
content, not just exit code" — texto literal del package.json del fixture).
Secuencia: construir el harness como infraestructura privada con un **codemod
sintético de auto-test** (renombre plantado, test-only — fuerte precedente:
los gates visuales siembran su propia baseline, `audit:gate` planta decoys), y
publicar el paquete recién junto al primer breaking release (0.x→1.0), con su
codemod real escrito contra el diff de API concreto.

### P4. Versionado y registro de transiciones

`migrate` versiona independiente (no entra en `linked`/`fixed` de changesets)
y no depende de `components` — solo lee código del consumidor. Codemods
nombrados por transición (`0.x-to-1.0`) en un registro interno
codemod-id → rango-origen → versión-destino. Gate futuro posible: un changeset
de tipo major sin referencia a codemod falla el CI — extiende `O3` de
"existe una guía" a "existe una migración ejecutable".

## Plan de implementación (PRs ≤400 líneas)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | Scaffold del paquete + bin + registro de transiciones + tests | ~250 |
| 2 | Harness de typecheck del fixture (tsconfig generado, ambient decls, runner de copia) + pre-gate en CI | ~200 |
| 3 | Codemod sintético de auto-test + wiring en `ci.yml` | ~300 |

Total ~750 líneas. El codemod real 0.x→1.0 es trabajo futuro dimensionado por
el breaking concreto.

## Alternativas consideradas

**Extender el lexer del audit como motor.** Descartada: es un localizador sin
AST; alcanza para renombres de specifier y nada más.

**Publicar el paquete ya, vacío.** Descartada: un gate que no prueba nada y
un paquete sin contenido contradicen el Principio 2.

**Esperar al breaking real para construir todo.** Descartada a medias: el
harness conviene ahora (es lo que tarda), el paquete espera.

## Riesgos

1. **Oráculo débil**: typecheck solo — mitigado con assert de contenido.
2. **Código de consumidores arbitrarios**: namespace imports (`Zui.Button`),
   `import()` dinámico, re-exports, alias, spread props que esconden una prop
   renombrada, MDX, JS sin tipos. La lista de blind spots RF-UAW05 del fixture
   es un catálogo de riesgos ya escrito. El gate prueba que **el fixture**
   migra, no consumidores arbitrarios — la claim pública debe decirlo.
3. **Churn de formato** en código ajeno (ts-morph reimprime nodos tocados).
4. **Doble uso del fixture** con el audit: considerar fixture dedicado si las
   necesidades divergen, o contrato explícito de co-propiedad.
