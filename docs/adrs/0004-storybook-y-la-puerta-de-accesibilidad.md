# ADR-0004: Storybook, la puerta de accesibilidad bloqueante y su integración en CI

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0001` (D1, D5); `ADR-0002` (D1, `packages/config`); `@zevaui/components`; `@zevaui/constraints` |

## Contexto

Las slices A y B dejaron `@zevaui/components` construible, con `Button` como
único componente y 36 pruebas en verde, y `@zevaui/tokens` emitiendo
`dist/styles.css` con 44 tokens semánticos `--zui-*`. `apps/storybook` era,
hasta esta slice, un `package.json` sin dependencias — un stub, no un
incremento. Faltaba resolver cuatro cosas antes de poder anunciar que el
sistema tiene gobernanza de accesibilidad real: qué motor de estilos usa
Panda internamente y por qué (la decisión ya tomada en slices previas,
pendiente de registrar con evidencia medida), cómo Storybook resuelve
`@zevaui/components` sin reintroducir el acoplamiento a `src` que el propio
paquete ya cerró en su build, cómo convertir "la accesibilidad es un
requisito funcional" (CONSTITUCION.md, principio 3) en una puerta que de
verdad puede fallar un build en vez de en una casilla de buenas intenciones,
y qué costo real tiene esa puerta.

## Decisión

### D1. PandaCSS con `eject: true`, `presets: ["@pandacss/preset-base"]`, `preflight: false`

Medido directamente sobre el recipe real de `Button` (mismo `include`, mismo
`staticCss` forzando las 9 combinaciones de variantes), comparando dos
configuraciones de `panda.config.ts` que solo difieren en la postura de
preset:

| Configuración | Líneas de CSS emitidas | Contiene paletas ajenas |
|---|---|---|
| Preset por defecto (`@pandacss/preset-panda`, sin eject) | **604** | Sí — `--colors-rose-50: #fff1f2`, `--colors-rose-500: #f43f5e`, y el resto de la escala de color por defecto de Panda |
| Postura eject actual (`eject: true`, `presets: ["@pandacss/preset-base"]`) | **141** | No — cero colores hexadecimales; `dist/styles.css` real coincide byte a byte en conteo de líneas con esta medición |

`@pandacss/preset-base` aporta el mapeo utilidad-CSS -> categoría-de-token
(`backgroundColor` -> `colors`, `borderRadius` -> `radii`, ...) sin un tema
por defecto, a diferencia de `@pandacss/preset-panda`. El costo es que
también emite, sin condición, un bloque `*, ::before, ::after, ::backdrop`
con ~35 custom properties inertes (`--blur`, `--translate-x`, `--scale-x`,
`--scroll-snap-strictness`, ...) más una variable de marca
`--made-with-panda`; ninguna es una propiedad CSS real (lo verifica G3 en
`__tests__/css-gates.test.ts`), así que no cambia nada que un consumidor
renderice, pero sí son bytes reales que viajan en cada build.

`presets: []` (sin ningún preset) es una trampa, no una alternativa válida:
elimina también las utilidades que traducen `backgroundColor: "accent.default"`
a una declaración CSS real, así que el recipe sigue compilando sin error de
tipos pero el bloque de declaraciones emitido queda con la sintaxis de token
sin resolver — `background-color: accent.default;` — que es CSS inválido, no
un valor por defecto silencioso. Es peor que un error de build porque pasa
desapercibido hasta que alguien inspecciona el CSS generado.

### D2. El puente de tokens es una cadena `var()`, no un valor literal

`--zuip-colors-accent-default: var(--zui-color-accent-default)` — cada
declaración de la capa `tokens` de Panda es un puntero, no una copia. G1 (en
`__tests__/css-gates.test.ts`) lo hace mecánico: falla si cualquier
declaración de esa capa no matchea
`--zuip-[a-z0-9-]+:\s*var\(--zui-[a-z0-9-]+\)`. Esto es lo que hace cierta,
en la práctica y no solo en la intención, la afirmación de ADR-0001 D2 de que
"Panda no es dueño de los tokens: solo los referencia" — la garantía vive en
un gate que corre en cada build, no en la disciplina de quien edite
`panda.config.ts` después.

### D3. `styled-system` nunca se importa desde `src/`; `panda codegen` nunca es parte del build

`panda.config.ts` importa `buttonRecipe` desde `src/button/button.recipe.ts`
— la dependencia va de la herramienta de build hacia el dominio, nunca al
revés. El recipe es un módulo `.ts` corriente, sin generación de código, y el
build (`tsc && panda cssgen ... && node scripts/build-manifest.js`) nunca
invoca `panda codegen`. G7 (`__tests__/emit-gates.test.ts`) lo hace mecánico:
falla si `dist/` re-expone cualquier cosa bajo `styled-system`. Esta
dirección de dependencia es la que permite que `src/` siga siendo legible y
testeable sin necesitar que Panda haya corrido primero.

### D4. `staticCss` se deriva del recipe, nunca se enumera a mano

`panda.config.ts` calcula `allButtonVariants` con
`Object.fromEntries(Object.entries(buttonRecipe.variants).map(...))` y se lo
pasa a `staticCss.recipes.button`. La extracción de Panda es dirigida por
uso: sin `staticCss`, una variante que el código fuente nunca renderiza
literalmente (por ejemplo porque solo se construye dinámicamente en tiempo
de ejecución) no aparece en el CSS final. El consumidor recibe un botón sin
estilo — cada prueba interna sigue en verde porque nada en el propio paquete
ejercita esa combinación — y el fallo solo es visible en la aplicación
consumidora, en producción. Derivar `staticCss` del propio recipe (en vez de
escribir la lista de combinaciones a mano en `panda.config.ts`) hace que
"toda variante declarada se emite" sea una propiedad de la config, no una
promesa que hay que recordar mantener sincronizada.

### D5. `Button` no expone `className` ni `style`

`button.types.ts` declara ambas props como `never`. No es una omisión: es la
única forma de que RF-04 (los componentes no exponen clases arbitrarias) y
RF-07 (los componentes solo consumen `--zui-*`, nunca reciben estilos
inyectados) sean imposibles de violar por construcción, en vez de
solo-mal-vistas-en-code-review. `__tests__/button.test.ts` fija esta
garantía con una prueba de tipos en tiempo de compilación. La consecuencia
de versionado es asimétrica: ampliar esta API más adelante (por ejemplo,
agregar una prop `className` en una v2 con opt-in explícito) es un cambio
menor; angostarla — quitar algo que ya se exponía — sería breaking, así que
no exponerla ahora es la opción reversible.

### D6. El tamaño de `Button` usa dos tokens más proporciones del recipe, no seis tokens independientes

`button.recipe.ts` calcula `sm` y `lg` como `calc({spacing.button.px} * 0.75)`
y `calc({spacing.button.px} * 1.5)` sobre los mismos dos tokens
(`space-button-px`, `space-button-py`) que usa `md`, en vez de declarar seis
tokens de espaciado independientes (`space-button-px-sm`,
`space-button-px-md`, ... x2 ejes x3 tamaños). La relación proporcional
entre tamaños es una decisión del sistema de diseño, no un detalle de
implementación: si cada tamaño tuviera su propio token sin relación
declarada entre ellos, nada impediría que un futuro cambio de tokens hiciera
que `sm` terminara siendo visualmente más grande que `lg`, rompiendo la
escala sin que ningún tipo ni gate lo detecte.

### D7. La puerta de accesibilidad usa `addon-vitest` dentro de `turbo run test`; jsdom queda descartado por construcción

`apps/storybook` corre sus pruebas de componente (incluida la de
accesibilidad) con `@storybook/addon-vitest` en modo navegador —
Playwright/Chromium real, no una simulación. **jsdom no es un sustituto
aceptable**: la regla `color-contrast` de `axe-core` necesita medir
`getComputedStyle` sobre un layout y una composición de colores realmente
pintados, algo que jsdom no implementa (no tiene motor de layout ni de
pintado). Una puerta de accesibilidad corriendo en jsdom sería
estructuralmente incapaz de atrapar exactamente la clase de violación que
`@zevaui/constraints` existe para vigilar — el mismo tipo de contraste que
hoy falla WCAG 1.4.11 en `color-border-strong` (ver el README de
`@zevaui/constraints`). Se verificó además, con la historia deliberadamente
rota `stories/__gate__/BrokenA11y.stories.tsx` (un `Button` solo-ícono sin
nombre accesible), que la puerta corriendo en Chromium real sí detecta la
violación `button-name` de axe — ver `apps/storybook/scripts/assert-gate-fails.js`
y su evidencia de ejecución.

**Costo registrado:** `pnpm test` ahora requiere un navegador Playwright
instalado localmente (`pnpm exec playwright install chromium`), algo que
antes de esta slice el monorepo no necesitaba en absoluto.

### D8. `packages/config` sigue vacío — desviación registrada de ADR-0002 D1

ADR-0002 (D1) reservó `packages/config` para configuración compartida entre
workspaces. Esta slice agrega un segundo consumidor real de Vitest en modo
navegador (`apps/storybook`, además de las suites jsdom/node existentes de
`packages/components`, `packages/constraints` y `packages/mcp`), pero
`vitest.shared.ts` vive dentro de `apps/storybook/` en vez de extraerse a
`packages/config`, porque hoy sigue siendo el único consumidor de esa
configuración concreta (browser mode + `storybookTest`). Es una desviación
consciente de ADR-0002 D1, no un olvido: el disparador de extracción es el
momento en que un segundo workspace necesite configurar Panda o Vitest en
modo navegador de forma compartida — hoy ese segundo consumidor no existe.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| `presets: []` en `panda.config.ts` | Elimina también las utilidades de traducción de propiedades; el recipe sigue "compilando" pero emite CSS inválido (`background-color: accent.default;`) que pasa desapercibido hasta inspeccionar el output. |
| `@pandacss/preset-panda` (tema por defecto, sin eject) | 604 líneas de CSS medidas, con paletas de color ajenas al sistema (`--colors-rose-50: #fff1f2` y el resto de la escala rose) que ADR-0001 D2 ya descartó como fuente de verdad. |
| Enumerar `staticCss` a mano en vez de derivarlo del recipe | Una variante añadida al recipe y no listada a mano se emite sin estilo en el consumidor; todas las pruebas internas del paquete siguen en verde porque nada las ejercita. |
| Seis tokens de espaciado independientes por tamaño (en vez de dos tokens + proporciones) | Ninguna relación declarada entre tamaños; nada impide que un cambio de tokens futuro haga que `sm` termine siendo más grande que `lg`. |
| Exponer `className`/`style` en `Button` con documentación de "no lo uses" | Documentación no es enforcement; RF-04/RF-07 quedarían violables por cualquier consumidor que ignore el README. |
| Test-runner de Storybook (Jest + Playwright orquestado) en vez de `addon-vitest` | Requiere levantar y servir un build de Storybook antes de poder correr las pruebas; `addon-vitest` transforma las historias directamente en pruebas de Vitest sin ese paso, y ya corre en modo navegador con Chromium real. |
| Puerta de accesibilidad en jsdom | La regla `color-contrast` de axe-core no puede ejecutar sin un motor de layout/pintado real; una puerta en jsdom sería incapaz de atrapar la clase exacta de violación que `@zevaui/constraints` vigila. |
| Extraer ya `vitest.shared.ts` a `packages/config` | `apps/storybook` es hoy su único consumidor; extraerlo ahora sería especular sobre una necesidad que todavía no existe (ver D8). |

## Consecuencias

**Positivas**

- La postura eject de Panda tiene evidencia medida y reproducible (604 vs.
  141 líneas), no solo una afirmación en un comentario de código.
- El puente `--zuip-* -> var(--zui-*)` es imposible de romper por
  construcción, no solo por convención (G1).
- La puerta de accesibilidad corre en un navegador real dentro de
  `turbo run test`, sobre la misma superficie que verá un consumidor, y
  quedó demostrada capaz de fallar de verdad (`stories/__gate__/BrokenA11y.stories.tsx`
  + `assert-gate-fails.js`).
- `staticCss` derivado del recipe hace que "toda variante declarada se
  emite" sea una propiedad de la configuración, no una promesa manual.

**Negativas / costos**

- `pnpm test` ahora requiere un navegador Playwright instalado localmente;
  cualquier entorno de desarrollo nuevo necesita ese paso adicional antes de
  poder correr la suite completa.
- La postura eject sigue pagando una "tasa de plumbing" fija: `@pandacss/preset-base`
  emite ~42 líneas inertes (el bloque `*, ::before, ::after, ::backdrop` con
  ~35 custom properties más `--made-with-panda`) en cada build,
  independientemente de cuánto o poco use el recipe. Ninguna es una
  propiedad CSS real (G3 lo verifica), pero son bytes reales enviados al
  consumidor. Si el presupuesto de bundle de RNF-02 llega a hacer de esto un
  problema real, `panda cssgen --splitting` más un paso de concatenación que
  descarte las salidas de la capa `base`/`global` es la palanca documentada
  — no implementada aquí, porque ~42 líneas inertes no justifican hoy la
  maquinaria de build adicional.
- `packages/config` sigue vacío pese a que ADR-0002 lo reservó para esto; es
  una desviación registrada, no silenciosa (D8).

**Neutras**

- El caveat de `@zevaui/constraints` (WCAG 1.4.11 no enforced) no lo cierra
  ni lo empeora esta slice: la puerta de `addon-vitest` corre la regla
  `color-contrast` de axe sobre lo renderizado, que es una verificación
  complementaria y no la misma cobertura que el validador de contraste
  texto/fondo de `@zevaui/constraints`.

## Seguimiento (decisiones diferidas)

- Extraer `vitest.shared.ts` a `packages/config` (ADR-0002 D1) en cuanto
  exista un segundo consumidor de Vitest en modo navegador (disparador de
  D8).
- `panda cssgen --splitting` como palanca de reducción de bytes si RNF-02 lo
  exige (ver Consecuencias).
- Ampliar el roster de historias más allá de `Button` a medida que
  ADR-0001 (D8, Seguimiento) sume componentes al roster core (RF-05).

**Cierre de evidencia (2026-08-22, `ADR-0010`):** el caveat de `@zevaui/constraints`
citado en Consecuencias (Neutras) — WCAG 1.4.11 no enforced, `color-border-strong`
por debajo del piso — quedó cerrado por `ADR-0010`. Re-corrida la puerta de axe de
Storybook contra los cinco repoints de token: sin delta, como se esperaba, porque
axe nunca inspeccionó bordes (la regla `color-contrast` evalúa texto, no elementos
decorativos — el límite exacto que este ADR ya documentó en D7). La única superficie
de texto real que toca un token repuntado es `color-text-inverse` sobre un fondo
`{tono}-default`, el par que usa `Button visual="{tono}"`: medido en 4.94 (`success`,
light) / 5.05 (`warning`, light) / 7.26 (`danger`, dark), todos por encima del piso
de texto 4.5 de su tema. `Button visual="danger"` en `light` no usa ningún token
repuntado y queda sin cambios en 4.76. Ningún componente client necesitó cambios.
