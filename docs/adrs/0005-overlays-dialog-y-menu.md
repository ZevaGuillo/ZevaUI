# ADR-0005: Overlays (`Dialog` y `Menu`): scrim, separación de superficie y composición

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0001` (D3, D5); `ADR-0004` (D1, D4, D5, D7); `@zevaui/constraints`; `CONSTITUTION.md` — RF-05, RF-07, RNF-01 |

## Contexto

Hasta esta slice, `@zevaui/components` publicaba un único componente
(`Button`), de una sola parte, que no se despega de su contenedor ni tapa
nada. `Dialog` y `Menu` son los dos primeros componentes **multi-parte** y
los dos primeros **overlays**: se portalan a `document.body`, se pintan
encima del contenido de la aplicación consumidora y tienen que separarse
visualmente de él.

Eso abre cinco preguntas que `Button` nunca obligó a responder:

1. Cómo se hace translúcido el fondo de un modal sin apagar también el
   contenido que está encima de él.
2. Cómo se separa una superficie elevada del resto de la página cuando el
   único borde neutro suficientemente fuerte que el sistema publica —
   `color-border-strong` — mide por debajo del umbral de WCAG 1.4.11.
3. Qué radio usa una superficie flotante cuando el sistema no tiene un token
   semántico de radio para overlays.
4. Cómo se cumple RF-07 ("cada componente expone slots para composición, sin
   variación estructural por el consumidor") en dos componentes cuya
   semántica ARIA impone la estructura del DOM.
5. Cómo interactúa el ocultamiento del contenido de fondo que hace react-aria
   con la puerta de accesibilidad bloqueante que ADR-0004 (D7) dejó corriendo
   en Chromium real.

Ninguna de las cinco tiene una respuesta obvia, y tres de ellas terminaron
restringiendo el diseño de los componentes, no solo su implementación.

## Decisión

### D1. El scrim lleva su alfa en el canal de color, nunca en `opacity`

`react-aria-components` renderiza `Modal` **como hijo** de `ModalOverlay`, y
un hijo no puede optar por salirse de la `opacity` de un ancestro: `opacity`
es una propiedad que crea un grupo de composición y se aplica al subárbol
completo. Poner `opacity: 0.6` en el overlay no produce un scrim
translúcido con un modal nítido encima; produce un modal desvanecido junto
con su fondo.

La translucidez vive entonces en el **canal de color del propio scrim**:

```css
background-color: color-mix(in srgb, var(--zuip-colors-bg-inverse) 60%, transparent);
```

`color-mix` compone el alfa dentro del valor del color, así que el fondo se
pinta translúcido y el modal —hijo suyo— queda intacto. El mezclado se toma
sobre el token **semántico** `color-bg-inverse` (no sobre un literal), lo que
mantiene el valor emitido como una referencia `var(--zuip-*)` pura y deja
intactos el puente de tokens (G1/G4) y la prohibición de colores literales
(G2).

La misma regla gobierna la animación de entrada y salida: **el overlay anima
`background-color`, el modal anima `transform`**. `Menu` sigue la misma
norma — su popover anima `transform` (y elige la dirección del
desplazamiento leyendo el `data-placement` que react-aria *resolvió*, no el
que pidió el consumidor).

**Medido** sobre el `dist/styles.css` real (429 líneas): `opacity` aparece en
**0 de las 19** reglas `.zui-dialog*` y en **0 de las 25** reglas
`.zui-menu*`. La única declaración `opacity` de todo el stylesheet es
`.zui-button[data-disabled] { opacity: 0.5 }`, anterior a esta slice.
`__tests__/dialog.test.ts` lo fija contra el CSS emitido, no contra el
fuente del recipe.

### D2. La separación de la superficie es sombra sobre fondo opaco, nunca `color-border-strong`

`color-border-strong` **falla WCAG 1.4.11 (contraste de elementos no
textuales) de forma medida**, contra el fondo del canvas en los dos temas
base (ver el README de `@zevaui/constraints`):

| Tema | Ratio medido | Requerido |
|---|---|---|
| claro | 2.49:1 | 3.0:1 |
| oscuro | 2.66:1 | 3.0:1 |

Un borde dibujado con ese token sería exactamente el tipo de límite de
componente que 1.4.11 exige que sea perceptible, y no lo es. Así que ningún
overlay se separa con un borde: `Dialog` usa `shadow-modal` y `Menu` usa
`shadow-dropdown`, ambos **sobre un `color-bg-surface` opaco**.
`color-border-default` sigue usándose solo para las divisorias internas del
header y el footer de `Dialog`, exactamente como lo usa `Button` — son
separaciones dentro de una superficie ya establecida, no el límite del
componente contra la página.

**La consecuencia que hay que registrar honestamente es de diseño, no de
implementación: ninguno de los dos overlays tiene eje de tono o intención.**
No hay `tone="danger"` en `Dialog` ni `intent` en `Menu`. Un overlay con
color de intención necesita un límite coloreado que lo distinga, y el único
neutro suficientemente fuerte que el sistema publica es justamente el que
falla el umbral. Los cuatro ejes de variante que esta slice agrega son
puramente **geométricos**: `Dialog` expone `size` y `placement`, `Menu`
expone `size` y `width`.

Esta es la primera vez que la satisfacción parcial de RNF-01 deja de ser un
caveat en un README y **restringe de verdad una decisión de diseño**. Vale
la pena decirlo en voz alta: esta slice no cierra ese hueco, lo esquiva.

### D3. No existe un radio semántico para overlays; ambos reutilizan `radius-card`

`@zevaui/tokens` publica exactamente **tres** tokens semánticos de radio —
`radius-button`, `radius-card`, `radius-input` (verificado sobre los 44
tokens semánticos de `tokens.manifest.json`). Ninguno nombra un overlay.

Los dos overlays usan `radius-card`, que es el radio de superficie que el
sistema ya envía. No se inventan `radius-modal` ni `radius-dropdown`. Un
token semántico es una promesa de API: una vez publicado hay que sostenerlo,
temarlo en los tres temas base y validarlo. Dos tokens nuevos cuyo único
valor sería ser alias de `radius-card` agregan superficie de contrato sin
agregar capacidad. El disparador para crearlos es concreto y todavía no
ocurrió: que un tema base necesite que una superficie flotante tenga un
radio **distinto** al de una tarjeta.

### D4. RF-07 se cumple con props de contenido tipadas, no con composición por `children`

Ninguno de los dos overlays acepta que el consumidor arme su estructura.

- `Dialog` recibe un `title: string` **obligatorio** más slots de contenido
  tipados como `ReactNode` (`children` para el cuerpo, `description`,
  `footer`), y renderiza él mismo su control de cierre.
- `Menu` recibe `items: readonly MenuItemDescriptor[]` —los renglones
  descritos como datos— y **es dueño de su propio trigger**.

El razonamiento es semántico, no estético:

- `role="menu"` solo admite hijos `menuitem`. Exponer los renglones como
  `children` sería exponer una estructura que el consumidor puede romper.
- La colección de react-aria necesita una clave estable por renglón; el
  descriptor la vuelve obligatoria (`id`) en vez de opcional.
- `MenuTrigger` cablea el botón y el popover por contexto, y react-aria
  **deriva el nombre accesible del menú desde el trigger**. Dejar el trigger
  en manos del consumidor devolvería tanto la forma del DOM como el nombre
  accesible del menú a quien RF-07 dice que no debe tenerlos.

Exponer esas costuras exportaría **estructura**, no contenido. Y los dos
componentes hacen obligatorio el nombre accesible por tipos: `title` en
`Dialog` y `label` en `MenuItemDescriptor` son `string` requeridos, no
`ReactNode` opcionales, precisamente porque un overlay sin nombre real falla
la puerta de axe de ADR-0004.

La coherencia interna se mantiene reusando el propio sistema: `Menu`
renderiza el `Button visual="subtle"` de este design system como trigger, del
mismo modo en que `Dialog` renderiza `Button visual="subtle" size="sm"` como
control de cierre. El trigger **no es un slot** del recipe de `Menu`; su
estilo pertenece al recipe de `Button`, y por eso las listas de tokens de los
dos componentes quedan disjuntas en el manifest (ver D5, "Consecuencias").

Ambos declaran `className` y `style` como `never`, igual que `Button`
(ADR-0004 D5).

### D5. Los dos overlays sacan el contenido de fondo con `inert`, no con `aria-hidden` — y las stories todavía divergen

react-aria oculta el contenido de fondo mientras un overlay está abierto. La
puerta de accesibilidad de ADR-0004 (D7) corre axe en Chromium real, y la
regla `aria-hidden-focus` de axe falla si queda un control enfocable dentro
de un subárbol marcado `aria-hidden="true"`. Así que **cómo** oculta
react-aria decide si una story puede dejar su trigger en pantalla mientras
axe escanea.

**Medido sobre la `react-aria@3.51.0` instalada, leyendo el dist:** los dos
caminos toman **la misma** rama.

| Camino | Hook | Llamada |
|---|---|---|
| `Dialog` (`ModalOverlay` + `Modal`) | `useModalOverlay` | `ariaHideOutside([ref], { shouldUseInert: true })` — `useModalOverlay.mjs:38` |
| `Menu` (`Popover`) | `usePopover` | `ariaHideOutside([ref], { shouldUseInert: true })` — `usePopover.mjs:54` |

`ariaHideOutside` resuelve `shouldUseInert && supportsInert` y, cuando el
navegador soporta `inert` (Chromium lo soporta), asigna la **propiedad
`inert`** en vez del atributo `aria-hidden="true"`. El fallback a
`aria-hidden` solo se toma donde `inert` no existe. Además, ni `Modal` ni
`ModalOverlay` ni `Dialog` de `react-aria-components` 1.20.0 escriben
`aria-hidden` por su cuenta.

Consecuencia real: `aria-hidden-focus` no tiene sobre qué dispararse en
**ninguno** de los dos overlays, porque el contenido queda genuinamente
inalcanzable, no meramente reetiquetado.

`Menu` toma esa medición y la convierte en una aserción: sus stories dejan el
trigger en pantalla y el menú abierto mientras axe escanea, y
`OpensNavigatesAndSelects` afirma explícitamente `inert === true` y la
ausencia de `aria-hidden` con el menú abierto, más `inert === false` al
cerrarlo. Si una react-aria futura abandona la rama de `inert`, esa story
falla con un mensaje legible en vez de como una violación opaca de axe.

Las stories de `Dialog` conservan el arreglo más conservador —renderizan el
diálogo solo, y la story con trigger lo cierra antes de que axe corra—, pero
por una razón distinta de la que su comentario de cabecera afirmaba al
escribirse esta slice. Ese comentario sostenía que `useModalOverlay` marca el
fondo con `aria-hidden`, y eso **no se sostiene contra la versión instalada**:
`useModalOverlay.mjs:38` pasa el mismo `shouldUseInert: true` que
`usePopover.mjs:54`. El arreglo nunca fue incorrecto —es estrictamente más
restrictivo que lo que el runtime exige, y las 8 stories pasan— pero la razón
anotada sí lo era, y quedó corregida en el mismo stream. Hoy el comentario
describe el mecanismo medido y explica que el arreglo se mantiene porque
minimiza la superficie que axe escanea por story, no porque el runtime lo
obligue.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| `opacity` en el `ModalOverlay` para el scrim | `Modal` es hijo del overlay y no puede salirse de la `opacity` del ancestro: desvanece el diálogo junto con el fondo. |
| Un `rgba()` literal para el scrim | Es un color literal en el CSS emitido: falla G2 y rompe la fuente única de verdad de ADR-0001 D2 (el valor dejaría de ser un puntero `var(--zui-*)`). |
| Animar la entrada/salida con `opacity` en vez de `background-color` + `transform` | Mismo problema del ancestro, pero intermitente: el texto del diálogo se apagaría solo durante la transición, que es justo cuando nadie lo mira en una prueba. |
| Separar el overlay de la página con un borde `color-border-strong` | Mide 2.49:1 (claro) y 2.66:1 (oscuro) contra un piso de 3.0:1 de WCAG 1.4.11: el límite del componente sería imperceptible para parte de los usuarios. |
| Agregar un eje `tone`/`intent` a `Dialog` o a `Menu` | Un overlay con color de intención necesita un límite coloreado, y el único neutro fuerte del sistema es el que falla 1.4.11. Se prefiere no enviar la variante a enviarla inaccesible. |
| Crear `radius-modal` y `radius-dropdown` | Serían dos alias de `radius-card` con la superficie de contrato de un token público (tres temas que sostener, validación, semver) y cero capacidad nueva. |
| Composición por `children` en `Dialog` y `Menu` | Le entrega al consumidor la estructura que RF-07 reserva para el design system: `role="menu"` solo admite hijos `menuitem`, la colección necesita una clave estable por renglón y `MenuTrigger` deriva el nombre accesible del menú desde el trigger. |
| Que el consumidor aporte el trigger de `Menu` | El nombre accesible del menú saldría de un botón que el design system no controla; un trigger solo-ícono sin nombre dejaría el menú anónimo sin que ningún tipo lo detecte. |
| Marcar los renglones deshabilitados con `isDisabled` en cada `MenuItem` | Medido en react-aria 3.51.0: `useMenuItem` lee `props.isDisabled ?? selectionManager.isDisabled(key)`, así que la prop por ítem pinta el renglón pero solo `disabledKeys` a nivel de colección hace que la navegación con flechas lo saltee. |
| Emitir un scroll lock (`body { overflow: hidden }`) desde el CSS del paquete | Sería un reset global (falla G3) y ADR-0001 D5 lo prohíbe; react-aria ya previene el scroll en JavaScript mientras el modal está abierto. |
| Correr las stories de `Menu` sin el trigger en pantalla, como las de `Dialog` | Habría escondido la pregunta en vez de responderla; la medición de `inert` es lo que permite afirmar que la puerta de axe pasa por la razón correcta y no por casualidad. |

## Consecuencias

**Positivas**

- Los dos overlays aportan **52 pruebas** (`dialog.test.ts` 22 y `menu.test.ts`
  30, los únicos archivos de prueba que la slice agregó). Medido sobre `main`
  ya con `Input` integrado, la suite de `@zevaui/components` queda en **139
  pruebas repartidas en 10 archivos**, todas en verde.
- La puerta de accesibilidad corre **39 stories en Chromium real, todas en
  verde** (11 de `Button`, 13 de `Input`, 8 de `Dialog`, 7 de `Menu`; la story
  deliberadamente rota de `__gate__` queda fuera por tag). Los overlays aportan
  15 de esas 39.
- El scoping de tokens por componente del manifest quedó **probado con cuatro
  componentes**, que es donde recién significa algo: `Dialog` reclama
  `--zui-shadow-modal` y **no** `--zui-shadow-dropdown` (16 tokens), `Menu`
  exactamente al revés (16 tokens), `Input` ninguno de los dos (15 tokens) y
  `Button` tampoco (17 tokens). Un escaneo del `dist/styles.css` completo
  —correcto mientras había un solo componente— habría hecho que los cuatro
  reclamaran todo.
- Cero primitivos: las 64 entradas de token que declaran los cuatro componentes
  (34 tokens distintos) son todas semánticas; ninguno de los 113 primitivos
  de `tokens.manifest.json` aparece en el manifest de componentes.
- El registro de componentes absorbió los dos overlays sin tocar
  `panda.config.ts` más que para agregar los punteros de token que faltaban:
  una entrada por componente en `src/registry.ts` y el propio recipe decide
  si va a `theme.recipes` o a `theme.slotRecipes`.

**Negativas / costos**

- **`__tests__/menu.test.ts` instala un shim de `CSS.escape`.** jsdom 26 no
  publica un objeto global `CSS`, y react-aria 3.51.0 llama a `CSS.escape`
  cada vez que resuelve el nodo del ítem enfocado (`getItemElement`, que usa
  cada movimiento de flecha y cada activación de renglón). Es una carencia
  **del entorno de prueba, no del componente**: el shim está guardado con
  `??=` (no pisa una implementación real) y `apps/storybook/stories/Menu.stories.tsx`
  recorre exactamente el mismo código en Chromium sin shim alguno. Aun así es
  una diferencia real entre lo que corre en jsdom y lo que corre en el
  navegador, y hay que saberlo antes de confiar en una prueba de teclado de
  jsdom.
- **RNF-01 (WCAG 2.2 AA) sigue parcialmente satisfecha.** El hueco de 1.4.11
  sobre `color-border-strong` no se cerró en esta slice; se trabajó
  *alrededor* de él (D2). El costo no es teórico: es un eje de variante que
  los dos overlays no tienen.
- Las stories de `Dialog` siguen siendo más restrictivas de lo que el runtime
  exige: renderizan el diálogo solo en vez de dejar el trigger en pantalla como
  hace `Menu` (D5). Se mantiene a propósito —acota la superficie que axe
  escanea— pero es una asimetría entre dos componentes que ya se sabe que
  comparten mecanismo.
- El overlay de `Dialog` fija `z-index: 50` como valor crudo. No existe un
  token semántico de capa y crear uno estaba fuera del alcance de esta slice;
  un consumidor con sus propios contextos de apilamiento puede necesitar
  ajustarlo y hoy no tiene un `--zui-*` con el que hacerlo.

**Neutras**

- `shadow-modal` y `shadow-dropdown` ya existían como tokens semánticos en
  `@zevaui/tokens`: esta slice solo agregó la categoría `shadows` de punteros
  en `panda.config.ts`, no tokens nuevos.
- Los dos overlays honran `prefers-reduced-motion: reduce` cancelando su
  transición; no es una decisión discutida, es la línea base.

## Seguimiento (decisiones diferidas)

- Darle a `Dialog` la misma aserción explícita de `inert` que ya tiene
  `OpensNavigatesAndSelects` en `Menu`, para que las dos rutas de overlay
  fallen igual de legible si una react-aria futura abandona esa rama (D5). El
  comentario de cabecera ya quedó alineado con el mecanismo medido.
- Cerrar de verdad el hueco de WCAG 1.4.11: subir `color-border-strong` por
  encima de 3.0:1 en los tres temas y extender el contrato de
  `@zevaui/constraints` a pares no textuales. Ese es el disparador para
  reabrir el eje de tono de los overlays (D2).
- Un token semántico de capa (`z-index`) cuando exista un segundo componente
  que se apile, o el primer reporte de un consumidor cuyo stacking context
  tape el diálogo.
- `radius-modal` / `radius-dropdown` solo si un tema base necesita que una
  superficie flotante difiera de una tarjeta (D3).
- Completar el roster core de RF-05: con `Button`, `Dialog` y `Menu` van tres
  de los seis componentes.

**Cierre de evidencia (2026-08-22, `ADR-0010`):** "Cerrar de verdad el hueco de
WCAG 1.4.11" quedó cerrado por `ADR-0010` — los cinco repoints de token, incluido
`color-border-strong` (ahora 4.63/4.84 en `light`, 4.16/3.67 en `dark`, ambos sobre
el piso de 3.0). Con eso resuelto, la frontera de alcance de esta ADR se verificó
explícitamente: **ningún eje `tone`/`intent` se agregó a `Dialog` ni a `Menu`** en
el cambio que cerró el hueco (`RF-CT14` lo prohibía de forma expresa). Que
`color-border-strong` ya limpie 1.4.11 no dispara automáticamente reabrir el eje de
tono de los overlays — sigue siendo una decisión de diseño independiente, que
permanece diferida, ahora explícitamente confirmada como fuera de alcance en vez de
bloqueada por un token que fallaba.
