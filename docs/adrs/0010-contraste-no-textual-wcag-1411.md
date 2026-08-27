# ADR-0010: Cierre del hueco de WCAG 1.4.11 (contraste no textual): una segunda clase de par, no un segundo eje de tema

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-22 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0004` (D7, caveat de axe); `ADR-0005` (D2, Seguimiento); `ADR-0006` (D2, D3, Seguimiento); `@zevaui/constraints`; `CONSTITUTION.md` — RNF-01 |

## Contexto

Tres ADRs anteriores documentaron el mismo hueco desde tres ángulos distintos
sin cerrarlo: `ADR-0004` (D7) registró que `color-border-strong` falla WCAG
1.4.11 y que la puerta de axe en Chromium no puede atraparlo porque la regla
`color-contrast` de axe-core solo evalúa texto. `ADR-0005` (D2) restringió el
diseño de `Dialog` y `Menu` alrededor del hueco — ningún overlay tiene eje de
tono porque el único borde neutro suficientemente fuerte del sistema falla el
piso. `ADR-0006` (D3) midió el mismo déficit en el borde de acento de `Alert`:
3 de 9 combinaciones tema/tono por debajo de 3.0:1, y dejó en Seguimiento
extender `@zevaui/constraints` a pares no textuales.

`@zevaui/constraints` valida hoy únicamente `contrastPairs`: pares
texto/fondo, juzgados contra el piso de cada tema (4.5:1 en `light`/`dark`,
7.0:1 en `high-contrast`). WCAG 1.4.11 exige un piso distinto — 3.0:1, sin
tier AAA — para límites de componente no textuales: bordes, y en este sistema
también el borde de acento de `Alert`, que usa `{tono}.default` sobre
`{tono}.subtle`. Ninguna estructura existente modela ese segundo piso sin
inventar un eje de tema que WCAG no define.

## Decisión

### D1. `checkContrast(luminances, pairs, minRatio)` — el piso es un parámetro, no una búsqueda por tema

`checkContrast` (exportada desde `validate-theme.ts`, no desde `index.ts` —
ver D5) pasó de inferir el piso internamente vía `minContrastRatioFor(themeId)`
a recibirlo como tercer argumento explícito:

```ts
export function checkContrast(
  luminances: Map<string, number>,
  pairs: readonly ContrastPair[],
  minRatio: number,
): Violation[];
```

`validateTheme` la llama dos veces con el mismo par de luminancias ya
resueltas:

```ts
const violations = [
  ...resolved.violations,
  ...checkContrast(luminances, contract.contrastPairs, minContrastRatioFor(theme.id)),
  ...checkContrast(luminances, contract.nonTextContrastPairs, contract.nonTextMinContrastRatio),
];
```

La alternativa descartada era `minContrastRatioFor(themeId, class)` — una
búsqueda por tema con un segundo eje de "clase". Se rechazó porque 1.4.11 no
tiene eje de tema: modelarlo como una búsqueda por tema invitaría, tarde o
temprano, a inventar un piso 7.0 no textual para `high-contrast` que la norma
no exige (ver D2). `minContrastRatioFor` queda byte a byte igual que antes,
así que sus dos pruebas existentes siguen en verde sin tocarlas.

### D2. Piso plano `nonTextMinContrastRatio: 3.0`, igual en los tres temas

`contract.json` declara un único escalar en la raíz del contrato,
`"nonTextMinContrastRatio": 3.0`, aplicado sin excepción a `light`, `dark` y
`high-contrast`. WCAG 1.4.11 es una regla de nivel AA sin contraparte AAA: no
existe un piso "reforzado" para contraste no textual en el nivel más alto de
conformidad. Los pares no textuales del tema `high-contrast` de hecho miden
muy por encima del piso (ver la tabla de D6), pero eso es holgura medida, no
una promesa de un tier más exigente.

### D3. Reutilizar `rule: "low-contrast"`; el tier se distingue por `expected: "3.0"`

Se descartó introducir un `ViolationRule` nuevo (por ejemplo
`"low-non-text-contrast"`). `packages/mcp/src/server.ts` fija
`violationRules` a la vez en un `z.enum` de Zod y en un `satisfies readonly
ViolationRule[]`: un miembro nuevo pasaría la comprobación `satisfies` (es un
subconjunto válido) pero rompería en runtime contra `structuredContent`, que
sí valida el enum de Zod. Mantener `ViolationRule` congelado es lo que permite
que el envoltorio MCP herede el tier 3.0 sin ningún cambio en
`packages/mcp/src` salvo la descripción de la herramienta (ver D6). El
`Violation` de una infracción no textual es indistinguible en forma de una
infracción de texto — mismo `rule`, mismos campos — y solo se distingue por
el valor de `expected` (`"3.0"` en vez de `"4.5"`/`"7.0"`).

### D4. `requiredTokens` como unión deduplicada de las dos clases de par

```ts
export const requiredTokens: readonly string[] = dedupeTokens([
  ...contract.contrastPairs,
  ...contract.nonTextContrastPairs,
]);
```

`dedupeTokens` en sí no cambió: sigue recorriendo `foreground`/`background`
de cada par y acumulando en un `Set`, preservando el orden de primera
aparición. Se descartó un `nonTextRequiredTokens` separado — habría obligado
a `resolveLuminances` a hacer dos pasadas de resolución y a los consumidores
de `@zevaui/mcp` a razonar sobre dos listas de tokens requeridos en vez de
una. Con la unión, `requiredTokens` pasó de 10 (línea base pre-cambio) a 13
en PR1 (mecanismo inerte, `nonTextContrastPairs: []` pero 3 pares de texto
nuevos) y a 17 en PR2 (los 5 pares no textuales poblados, que agregan
`color-border-strong` y los tres tokens `-default`).

### D5. `index.ts` no gana superficie pública nueva

`checkContrast` se exporta desde `validate-theme.ts`, no desde `index.ts`.
Las pruebas ya importan internos vía `../src/contract.js`; no había necesidad
de ampliar el barrel para que la nueva función fuera testeable. Mantener
`index.ts` sin cambios deja verdes `size:gate` y `audit:gate` (incluida la
prueba que fija la ausencia del re-export del barrel — ver el historial de
`audit`) — el delta de esta ADR es puramente de comportamiento, no de
superficie pública.

### D6. Los cinco repoints, con ratio final medido

Cinco `$value` de tokens semánticos, todos en `packages/tokens/tokens/themes/{light,dark}.json`,
ninguno en `high-contrast.json` ni en un primitivo compartido:

| Token | Tema | De -> A | Pares afectados | Ratio final |
|---|---|---|---|---|
| `color.border.strong` | light | `{gray.400}` -> `{gray.500}` | × `bg-canvas` / × `bg-surface` | **4.63** / **4.84** |
| `color.border.strong` | dark | `{gray.600}` -> `{gray.500}` | × `bg-canvas` / × `bg-surface` | **4.16** / **3.67** |
| `color.success.default` | light | `{green.600}` -> `{green.700}` | × `success-subtle` | **4.50** |
| `color.warning.default` | light | `{amber.500}` -> `{amber.700}` | × `warning-subtle` | **4.54** |
| `color.danger.default` | dark | `{red.500}` -> `{red.400}` | × `danger-subtle` | **3.48** |

Los cinco superan el piso de 3.0 exigido por D2; dos quedan con holgura
ajustada (dark border × surface 22%, dark danger 16%) y llevan pines
`toBeCloseTo` en `tokens-contract.gate.test.ts` (ver Seguimiento).

**El warning claro es una revisión explícita, no lo que se diseñó
originalmente.** El diseño inicial repuntaba `color.warning.default` a
`{amber.800}`, que mide **6.41:1** — un salto visual grande hacia un marrón
oscuro que se aleja de la identidad ámbar/naranja de "advertencia". Se
midieron las alternativas con la matemática del propio paquete:
`{amber.600}` da **2.87:1** y **no es viable** (sigue bajo el piso de 3.0);
`{amber.700}` da **4.54:1**, con 51% de holgura sobre el piso, y conserva el
matiz ámbar. El único consumidor de `warning-default` es el borde de acento
de `Alert` (`alert.recipe.ts:62`, no textual — ningún par de texto lo
referencia), así que el criterio de selección fue puramente visual una vez
que ambas opciones limpian el piso: el usuario del sistema decidió
`{amber.700}` sobre `{amber.800}` para minimizar el desplazamiento de matiz.
Ningún test tenía pineado el valor 6.41, así que la revisión tocó únicamente
el `$value` del token y la especificación — ningún archivo de test cambió por
este motivo.

### D7. `color-text-inverse` × `color-{tono}-default` queda considerado y diferido

Se evaluó agregar a `contrastPairs` (la clase de texto, no la no textual) los
pares `color-text-inverse` × cada `color-{tono}-default` recién repuntado,
razonando que texto inverso sobre un fondo de tono ya es una combinación real
en el sistema (el `Button` con `visual="danger"`, por ejemplo). Medido contra
los tres `-default` que sí cambiaron de valor en este cambio (no `border`,
que no es un fondo de texto):

| Par | Ratio medido |
|---|---|
| `color-text-inverse` × `color-success-default` (light, repuntado a `{green.700}`) | 4.94 |
| `color-text-inverse` × `color-warning-default` (light, repuntado a `{amber.700}`) | 5.05 |
| `color-text-inverse` × `color-danger-default` (dark, repuntado a `{red.400}`) | 7.26 |

Los tres limpian holgadamente el piso de texto de 4.5:1 de su propio tema. El
tercer valor (7.26) es el mismo que fija la regresión de `RF-CT05` para el
repoint de `dark danger-default` — no es una medición nueva, es la misma
verificación citada desde dos ángulos. `color-danger-default` en `light` **no**
se repuntó en este cambio, así que su par de texto inverso —el que usa
`Button visual="danger"` en el tema claro— queda **sin cambios en 4.76**.
Ninguno de los cuatro es frágil.

Aun así, la decisión fue **no** agregarlos en este cambio. Estos tres pares,
al vivir en `contrastPairs` (la clase de texto), heredarían automáticamente
el piso de `high-contrast` — **7.0:1**, no 4.5:1 — porque `contrastPairs` es
theme-scoped. Ninguno de los tres se midió contra el tema `high-contrast`
real en este cambio: agregar la entrada sin esa medición sería una expansión
de alcance sin evidencia, exactamente lo que D2 evita para el piso no
textual. Se registra aquí como considerado-y-diferido, con la Seguimiento
explícita más abajo, en vez de agregarse a ciegas o descartarse en silencio.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| `minContrastRatioFor(themeId, class)` con un segundo eje de "clase" | Modelaría un eje de tema para 1.4.11 que la norma no define, e invitaría a un piso 7.0 no textual en `high-contrast` sin base normativa. |
| Piso no textual escalonado por tema (p. ej. 3.0 en `light`/`dark`, algo mayor en `high-contrast`) | 1.4.11 es AA-only; no existe un tier AAA de contraste no textual que un piso mayor pudiera representar. |
| Nuevo `ViolationRule: "low-non-text-contrast"` | `server.ts` fija `violationRules` en un `z.enum` de Zod además del `satisfies`; un miembro nuevo pasaría la comprobación de tipos pero rompería `structuredContent` en runtime. |
| `nonTextRequiredTokens` separado de `requiredTokens` | Obligaría a dos pasadas de resolución de luminancias y a que los consumidores de MCP razonen sobre dos listas de tokens requeridos en vez de una unión. |
| Exportar `checkContrast` desde `index.ts` | Amplía el barrel público sin necesidad real: las pruebas ya importan internos vía `../src/contract.js`; mantenerlo interno deja `size:gate`/`audit:gate` sin tocar. |
| `{amber.800}` (6.41) para `color.warning.default` en `light` | Salto visual grande hacia un marrón oscuro; `{amber.700}` (4.54, 51% de holgura) limpia el piso igual de cómodo conservando el matiz ámbar. Decisión explícita del usuario, no del diseño original. |
| `{amber.600}` (2.87) para el mismo token | Sigue bajo el piso de 3.0 — no viable, descartado por medición, no por preferencia. |
| Agregar `color-text-inverse` × `color-{tono}-default` a `contrastPairs` ahora | Heredaría el piso de 7.0 de `high-contrast` sin que ese tema se haya medido contra estos pares; expansión de alcance sin evidencia (D7). |

## Consecuencias

**Positivas**

- El hueco que `ADR-0004` (D7), `ADR-0005` (D2) y `ADR-0006` (D3) documentaron
  por separado queda cerrado con un solo mecanismo: `@zevaui/constraints`
  ahora falla en CI si cualquier par no textual declarado cae bajo 3.0:1, en
  cualquiera de los tres temas.
- `@zevaui/mcp`'s `validate_theme` hereda el tier 3.0 sin ningún cambio de
  código en `packages/mcp/src` salvo la descripción de la herramienta —
  exactamente la promesa de D3.
- Los 5 repoints son puntuales: ningún primitivo de `primitives/colors.json`,
  ningún token `-subtle`, y `high-contrast.json` quedan sin tocar (alcance
  confirmado, ver `RF-CT14` en la especificación del cambio).
- El déficit de `Alert` que `ADR-0006` (D3) midió en 3 de 9 combinaciones
  tema/tono queda cerrado por los mismos repoints, sin que `Alert` necesitara
  ningún cambio de componente.

**Negativas / costos**

- Dos de los cinco ratios finales quedan con holgura ajustada: dark
  `border-strong` × `bg-surface` en 3.67 (22% de holgura) y dark
  `danger-default` × `danger-subtle` en 3.48 (16%). Ambos llevan pines
  `toBeCloseTo` (ver Seguimiento) siguiendo el mismo precedente que el pin
  frágil de `high-contrast text-success` (7.09, 1.3% de holgura) que el
  README de `@zevaui/constraints` ya documentaba.
- `contract.version` subió de 1.0.0 a 1.1.0 (en PR1, sin re-bump en PR2):
  cualquier candidato de MCP que pasara un mapa de 10 tokens ahora recibe
  hasta 7 infracciones adicionales de `missing-token` — cambio aditivo y
  esperado, pero consumer-visible.
- El par `color-text-inverse` × `color-{tono}-default` queda sin cobertura de
  contrato pese a estar medido y limpio; ver D7 y Seguimiento.

**Neutras**

- `high-contrast.json` no se tocó: sus pares no textuales ya medían por
  encima del piso plano de 3.0 antes de este cambio, así que no había nada
  que repuntar ahí.

## Seguimiento (decisiones diferidas)

- **Extender pines de holgura a los pares claros.** Hoy solo los dos ratios
  no textuales más ajustados de `dark` (3.48 y 3.67) llevan `toBeCloseTo` en
  `tokens-contract.gate.test.ts`. Los pares de `light` (4.63/4.84/4.50/4.54)
  tienen más holgura pero no están pineados; extender el mismo patrón de
  pines a `light` es un endurecimiento posible, deliberadamente no hecho en
  este cambio — el disparador es cualquier futura revisión de la escala de
  primitivos `gray`/`green`/`amber` que toque esos temas.
- **Cerrar `D7`**: medir `color-text-inverse` × `color-{tono}-default`
  contra el tema `high-contrast` real y, si limpia el piso de 7.0, agregar
  los tres pares a `contrastPairs`. Bloqueado únicamente por la falta de esa
  medición, no por ninguna duda de diseño.
- **`ADR-0005` Seguimiento — eje de tono en `Dialog`/`Menu`**: este cambio no
  lo reabre. `color-border-strong` ahora limpia 1.4.11, pero agregar
  `tone`/`intent` a los overlays sigue siendo una decisión de diseño
  independiente, fuera del alcance de este ADR (ver `RF-CT14`).
