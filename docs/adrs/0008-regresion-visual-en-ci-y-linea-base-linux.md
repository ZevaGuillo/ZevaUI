# ADR-0008: Regresión visual sobre el arnés existente, con captura del viewport y líneas base solo de Linux

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-18 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0004` (D7, el mismo arnés Chromium; la puerta de accesibilidad y su fixture negativo); `ADR-0005` (D1 scrim, movimiento reducido); `ADR-0006` (D3, huecos registrados); `ADR-0007`; `CONSTITUTION.md` — RF-18, Principio 2 |

## Contexto

RF-18 exige pruebas de regresión visual automatizadas en CI. Hasta esta
slice no existía ninguna: nada detectaba que un cambio de token, un refactor
de layout o un bump de `react-aria-components` alterara lo que un usuario
efectivamente ve.

El arnés ya estaba puesto. ADR-0004 D7 dejó `@storybook/addon-vitest`
corriendo las 44 historias en Chromium real vía Playwright, porque la regla
`color-contrast` de axe no puede ejecutarse en jsdom. Ese mismo arnés
—mismo navegador, mismo viewport, mismas historias— es capaz de sacar
capturas. Montar un segundo arnés al lado sería pagar dos veces por el mismo
navegador.

El problema no era el arnés, era **qué se captura**. Los tests de
`packages/components` ya lo dejan fijado por escrito: `dialog.test.ts`
(líneas 39-48) y `menu.test.ts` (líneas 60-65) documentan que
`Modal`/`ModalOverlay` y `Popover` se **portalan fuera** del contenedor de
render. En consecuencia:

- Las historias de `Dialog` renderizan el diálogo solo, sin trigger, así que
  su `canvasElement` queda efectivamente **vacío**.
- Las historias de `Menu` conservan el trigger en la raíz, pero **no** el
  popover.

La llamada obvia —`expect.element(page.elementLocator(canvasElement))
.toMatchScreenshot()`— capturaría entonces un lienzo vacío o con solo el
trigger en **14 de las 38** líneas base previstas. Esas capturas serían
estables byte a byte para siempre y **pasarían sin afirmar nada**. Una
puerta que no puede fallar es peor que no tener puerta: da una señal de
seguridad falsa.

## Decisión

### D1. Se reutiliza el arnés Storybook + addon-vitest, con cero dependencias nuevas

La captura se implementa dentro del mismo `vitest.shared.ts` y del mismo
`.storybook/preview.ts` que ya sirven a la puerta de accesibilidad. No entra
ninguna dependencia: `@vitest/browser` ya trae el matcher
`toMatchScreenshot` y Playwright ya está instalado. Las alternativas
descartadas por ADR-0004 D7 (test-runner de Storybook, Playwright autónomo,
Chromatic) no se reabren aquí, porque readoptar una alternativa ya rechazada
exigiría evidencia nueva y no la hay.

### D2. El objetivo de captura es el viewport, no el lienzo de la historia

Regla: **toda caja de captura debe abarcar el viewport fijado**, para que
cualquier contenido portalado con `position: fixed` pintado encima quede
dentro del cuadro.

El mecanismo resultó tener dos capas, y la segunda solo se descubrió
midiendo:

1. `canvasElement.style.minHeight = "100vh"` y `width = "1200px"` fijan la
   caja del propio lienzo.
2. `@storybook/addon-vitest` envuelve el iframe de la historia en su propio
   contenedor `#vitest-tester`, que vive en el documento **padre** y por lo
   tanto fuera del modelo de cajas de `canvasElement`. Ese contenedor sí es
   alcanzable —el iframe es del mismo origen que su host, así que
   `window.parent.document` resuelve— y hay que intervenirlo.

**El número que lo explica todo**: `#vitest-tester` lleva un `width`/`height`
en línea (960 px / 900 px medidos) **y además** un `transform: scale(0,8)`
propio, su zoom de "encajar la historia en el panel visible".
`getBoundingClientRect()` reporta el tamaño **post-transform**, que es
exactamente lo que captura Playwright. De ahí que `960 = 1.200 × 0,8` y
`720 = 900 × 0,8`: los dos números que parecían independientes eran
artefactos de **una sola** escala. Poner solo `width` dejaba
`getComputedStyle().width` en 1.200 px con el rect todavía en 960. Un
`100vw` a secas solo llegaba a 1.024 px, porque el bloque contenedor de
`#vitest-tester` no es el viewport fijado.

La corrección fija cuatro propiedades con `!important` sobre ese contenedor:
`width: 1200px`, `max-width: none`, `transform: none`, `height: 720px`.
1.200 es el ancho interno del propio iframe de la historia, no 1.280 (la
página externa): el scrim cubre el viewport del iframe, que es lo que el
usuario efectivamente ve.

**Resultado medido, no inferido**: las 38 líneas base miden exactamente
**1.200 × 720**, `Dialog` incluido, leído de los bytes IHDR de cada PNG. El
scrim de ADR-0005 llega visiblemente a ambos bordes del cuadro; `Card`,
`Button` y el `Menu` portalado renderizan limpios, sin desbordes ni
artefactos de scrollbar.

Alcanzar el documento padre desde un hook de preview es una técnica
**genuinamente inusual** y se registra como tal. Va envuelta en `try`/`catch`:
si `window.parent` fuera alguna vez de otro origen, o si una versión futura
de addon-vitest renombrara o quitara el contenedor, degrada a la captura sin
ensanchar en vez de romper el test. Ese modo degradado es **ruidoso, no
silencioso**: el cuadro volvería a 960 × 720 y las 38 comparaciones
fallarían a la vez.

### D3. La captura es un `afterEach` fail-closed, condicionado por la corrida y no por la historia

Vive en `.storybook/preview.ts`, así que **toda historia con la etiqueta
`visual` se captura sin cableado por historia que alguien pueda olvidar** —
la misma propiedad fail-closed que D2 existe para proteger. Las 6 historias
con `play` se excluyen explícitamente con `"!visual"`.

El guard **no** puede leer las etiquetas de la historia. `visual` y `test`
no son mutuamente excluyentes: los 6 archivos de historias llevan las dos, de
modo que una etiqueta a nivel historia nunca puede decirle al hook qué
configuración la está ejecutando. La constante `__VISUAL_CAPTURE__` se
resuelve una sola vez **por configuración**, en tiempo de carga, desde el
`tags.include` de esa misma configuración. La corrida normal y la puerta de
accesibilidad hornean `false` y el hook es un no-op real ahí.

Esa constante se deriva por **prefijo** (`visual`, `visual-negative`,
`visual-negative-overlay`, y cualquier partición futura), no por una lista
exacta. El costo de olvidar extender una lista es asimétrico: una
configuración visual que resuelva `false` correría sus historias **sin
ningún aserto de captura y saldría con código 0** — precisamente la falsa
aprobación que toda esta ADR existe para evitar.

### D4. Dos fixtures negativas, y la portalada es la que carga el peso

`BrokenVisual.stories.tsx` (un `Button`) prueba que la comparación detecta un
cambio de una letra en un componente que renderiza dentro de la raíz de la
historia. Eso **no alcanza**: seguiría pasando aunque el cuadro excluyera
todos los portales.

`BrokenVisualOverlay.stories.tsx` es la que cierra el hueco. Renderiza un
`Dialog` sin trigger —lienzo efectivamente vacío— y el texto que varía entre
corridas es el **título del diálogo**, que vive dentro del portal. Si el
cuadro contiene el nodo portalado, las dos corridas dan imágenes distintas y
la comparación **falla**: esa falla es la prueba. Si no lo contiene, las dos
dan el mismo cuadro y la comparación **pasa**. `assert-visual-overlay-fails.js`
lee ese pase como puerta FALLADA.

Cada fixture corre bajo su **propia** etiqueta y configuración aisladas. No
es prolijidad: los scripts argumentan desde un código de salida distinto de
cero, así que una corrida compartida podría salir en rojo por la otra fixture
y reportar una prueba del portal que nunca ocurrió.

Ambos scripts conservan el manejo de salida en tres ramas de
`assert-gate-fails.js` (código 0 → FALLO; `null` o ≥126 → FALLO de *crash*
con mensaje distinto; resto → PASA). Un crash reportado como puerta que pasa
es el peor resultado posible y es el que esa tercera rama existe para
impedir. El chequeo estructural del script del overlay exige las dimensiones
completas **1.200 × 720**, no solo la altura: el ancho es la dimensión que
carga el peso, porque el scrim abarca el cuadro horizontalmente.

### D5. Umbral: `allowedMismatchedPixels: 0` explícito y `threshold: 0.1`

| Perilla | Valor | Qué hace realmente |
|---|---|---|
| `allowedMismatchedPixels` | `0`, explícito | **No cambia el comportamiento.** El `context.d.ts` instalado ya define que `undefined` significa "cualquier diferencia distinta de cero falla". Su valor es documental: aflojarlo en el futuro será un diff visible en una línea explícita. |
| `threshold` | `0.1` (el default, reafirmado) | La perilla de **distancia de color percibida YIQ** de pixelmatch: decide si un píxel cuenta como distinto siquiera. Esto —y no una tolerancia de conteo— es lo que absorbe el antialiasing y la deriva sub-píxel. |
| `allowedMismatchedPixelRatio` | **rechazada** | Depende del tamaño del lienzo (el mismo ratio es mucho más laxo sobre un overlay del tamaño del viewport que sobre un `Button`), y el `ratio 0.01` que reportó el spike es aritméticamente inconsistente con 38/30.720 = 0,0012: su denominador no está verificado. Sabemos exactamente qué significan 38 px; no sabemos qué significa 0,01. |

Regla de escalado: aflojar cualquiera de las dos perillas exige una nota en
esta ADR, no un commit silencioso.

### D6. El determinismo se fija en el contexto del navegador, no se espera

`vitest.shared.ts` fija `viewport: 1280 × 720`, `deviceScaleFactor: 1`,
`reducedMotion: "reduce"` y `colorScheme: "light"` en el `contextOptions` de
Playwright. La justificación es que **las dimensiones de captura ya eran una
entrada no declarada**: nada fijaba el viewport, y el ancho del lienzo se
derivaba de él. `reducedMotion: "reduce"` es la palanca anti-flake más fuerte
disponible porque los componentes ya implementan ese camino (ADR-0005).
Al ser la configuración *compartida*, esto también cambia la corrida normal y
la puerta de accesibilidad: es el invariante declarado de ese archivo
—entorno idéntico en todas las corridas— y re-verificarlas fue tarea
explícita.

### D7. Líneas base solo de Linux, generadas por un `workflow_dispatch` que se autoverifica

Las líneas base **no se pueden autorar localmente**, y la razón es estructural:
`@vitest/browser` resuelve el nombre del archivo de referencia con sufijo de
plataforma, `<Historia>-1-chromium-<plataforma>.png` — observado
`Portalled-Title-1-chromium-win32.png` en Windows, `-chromium-linux` en CI.
Una PNG autorada en Windows es **invisible** para CI —no conflictiva— y CI
falla por referencia ausente. Inter se nombra en los tokens pero **nunca se
incrusta** (verificado: cero `@font-face` y cero archivos `woff` en el
repositorio), así que otro sistema operativo re-rasteriza cada glifo, muy por
encima de los 38 px que cuesta una regresión real de una letra.

El directorio es **plano**, al lado de los archivos de historias: el
`context.d.ts` instalado declara el default
`__screenshots__/${testFileName}/${testName}.png`, sin componente de ruta
intermedio. Esto importa fuera de la teoría — un pathspec
`stories/**/__screenshots__` en el `git add` del workflow matchea **cero
archivos**, porque el `**/` de git exige al menos un componente intermedio.
El workflow usa el directorio literal, y si una historia se mudara a un
subdirectorio el `git add` falla ruidosamente en vez de commitear vacío.

`.github/workflows/visual-baselines.yml` las genera. Sus propiedades no
negociables:

- **`workflow_dispatch` y nada más.** Sin `push`, sin `schedule`, sin
  `workflow_run`, sin `repository_dispatch`. Este job **nunca** debe correr
  automáticamente en respuesta a una puerta en rojo: re-bautizar sobre rojo
  **elimina** la puerta. La ausencia de esos disparadores es deliberada y
  está escrita en la cabecera del workflow.
- **Se autoverifica antes de commitear.** Un push hecho con `GITHUB_TOKEN`
  **no** re-dispara `on: push` ni `on: pull_request`. Sin ese paso las líneas
  base aterrizarían sin verificar y el siguiente PR no relacionado las
  heredaría. Verificar dentro del dispatch prueba la propiedad exacta que CI
  necesita —que las referencias se sostienen bajo `CI=true`— en el runner
  exacto que produjo los bytes. Si falla, el job falla y no se empuja nada.
- **Refspec explícito, nunca `--force`.** Si la rama se movió, el push se
  rechaza, el job falla y se re-despacha. Un `--force` descartaría en
  silencio lo que hubiera aterrizado en el medio.
- `inputs.ref` llega al shell por el entorno, nunca interpolado dentro de un
  string de comando: un nombre de rama malicioso es dato, no script.

La autorización es nativa de GitHub: despachar exige permiso de escritura, así
que no otorga autoridad que el usuario no tuviera, y no hay credencial que
administrar. **Forks**: la rama de un PR de fork vive en el fork, donde el
`GITHUB_TOKEN` de este repositorio no puede escribir; un maintainer aterriza
las líneas base regeneradas como commit de seguimiento.

### D8. Alcance de la primera rebanada, y los huecos que quedan nombrados

Cubre **38 historias, tema claro**, en 6 archivos que llevan `tags: ["visual"]`
a nivel meta —de modo que una historia nueva queda cubierta salvo que se
excluya— más 6 exclusiones `"!visual"` sobre las historias con `play`.

Los huecos, registrados y no escondidos, siguiendo el precedente de ADR-0004
y ADR-0006 D3:

- **Anillos de foco**: las 6 historias con `play` están excluidas.
- **Cuatro cruces de overlay** que faltan: `placement × size` en `Dialog`,
  `width × size` en `Menu`.
- **Temas oscuro y alto contraste**: requieren plumbing de decorator que hoy
  no existe (`preview.ts` no tiene decorator ni `globalTypes`) **y**
  apuntarían axe a los tokens oscuros, poniendo probablemente en rojo la
  puerta de accesibilidad **existente** contra los huecos de contraste que
  ADR-0006 D3 ya registró.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| `page.elementLocator(canvasElement)` sin modificar | `Modal`/`ModalOverlay` y `Popover` se portalan fuera del contenedor (`dialog.test.ts` línea 42, `menu.test.ts` línea 60). 14 de 38 líneas base capturarían un lienzo vacío y **pasarían para siempre sin afirmar nada**. |
| Capturar el nodo portalado resuelto por rol | Fija la profundidad de anidamiento interna de react-aria por componente —duplicando lo que `dialog.test.ts`/`menu.test.ts` ya fijan—, excluye el trigger del `Menu`, y hay que declararlo por historia: una historia de overlay futura que lo olvide vuelve en silencio a la falsa aprobación. |
| `elementLocator(document.body)` / `documentElement` | Un overlay `position: fixed` no aporta altura a sus ancestros; con la historia de `Dialog` casi vacía la caja colapsa y el recorte es una franja del scrim, o un crash de tamaño cero. Medido: es exactamente lo que ocurre. |
| Una API de página / `fullPage` | No existe. Verificado sobre el `context.d.ts` de `@vitest/browser@4.1.10` instalado: `fullPage` no aparece ni una vez en todo el archivo, y `ScreenshotMatcherOptions.screenshotOptions` es un `Omit<ScreenshotOptions, 'element' \| …>` — es decir, el matcher **excluye explícitamente** poder redirigir el objetivo de captura. Al invocarse sobre `expect.element(...)`, siempre es por elemento. |
| `parameters.visual.target` por historia | El mismo peligro de "omitir es aprobar" salvo que el default ya sea el viewport — en cuyo caso es D2 más una palanca sin usar. Queda registrada como palanca documentada, no implementada. |
| Una regla CSS `#storybook-root { min-height: 100vh }` en el preview | Depende de la identidad del selector de la raíz bajo addon-vitest, que no es el iframe de canvas simple. Poner el estilo sobre el `canvasElement` que el arnés entrega elimina la conjetura y co-ubica el dimensionado con la captura, para que no puedan divergir. |
| `allowedMismatchedPixelRatio` | Depende del tamaño del lienzo, y el `ratio 0.01` reportado es inconsistente con 38/30.720 = 0,0012: su denominador no está verificado. |
| Un umbral generoso para absorber la diferencia de fuentes entre sistemas | Inter se nombra en los tokens pero nunca se incrusta: otro sistema operativo re-rasteriza cada glifo, muy por encima de 38 px. Un umbral así de laxo absorbería también regresiones reales de copy y de layout. |
| Líneas base autoradas en Windows | El nombre de referencia lleva la plataforma: una PNG `-win32` es **invisible** para CI, no conflictiva, y CI falla por referencia ausente. |
| Docker / `mcr.microsoft.com/playwright` para generar líneas base localmente | Sin Inter incrustada, su sans-serif por defecto tendría que coincidir con el conjunto de fuentes mucho mayor de `ubuntu-latest`, y eso no está verificado. Queda como escotilla solo si un spike demuestra paridad de imagen. |
| Un PAT o GitHub App para que el push re-dispare CI | `workflow_dispatch` con `GITHUB_TOKEN` no guarda credenciales, y el paso de autoverificación demuestra más que una re-ejecución: prueba la propiedad exacta en el runner exacto. |
| Regenerar líneas base automáticamente cuando la puerta falla | Bautizar en rojo **elimina** la puerta. |
| Un guard de captura basado en las etiquetas de la historia | `visual` y `test` no son mutuamente excluyentes —los 6 archivos llevan ambas—, así que el guard resultaba verdadero también en la corrida normal. Medido: 38 fallos por "No existing reference screenshot found" en `vitest.config.ts`. Debe condicionarse por configuración. |
| Una sola fixture negativa | La fixture no portalada seguiría pasando aunque el cuadro excluyera todos los portales. La propiedad que importa quedaría sin afirmar. |
| Storybook test-runner / Playwright autónomo / Chromatic | Ya descartados por ADR-0004 D7; readoptar una alternativa rechazada exige evidencia nueva y no la hay. |

## Consecuencias

**Positivas**

- RF-18 tiene una puerta real, sobre el mismo navegador y el mismo viewport
  que ya usa la puerta de accesibilidad, con cero dependencias nuevas.
- El scrim de ADR-0005 está **dentro** del cuadro capturado, a 1.200 × 720
  medidos, no supuestos. Las 14 líneas base de overlay afirman algo.
- La cobertura es fail-closed en dos niveles: una historia nueva se captura
  salvo que se excluya, y una partición visual nueva captura por prefijo
  salvo que se excluya.
- Las dos fixtures negativas prueban condiciones independientes, y la del
  overlay prueba la única que la otra no puede.
- El peso del repositorio quedó muy por debajo de lo temido: **404,2 KB en
  total, 10,64 KB de promedio** por línea base, contra la estimación de
  600 KB - 1,2 MB de la exploración. El peso de las PNG **no** es razón para
  achicar la matriz.

**Negativas / costos**

- Las líneas base son del tamaño del viewport, así que **un cambio global
  genuino** (fondo del body, corrimiento de un token de color) pone en rojo
  las 38 a la vez. Se argumenta como comportamiento correcto de una puerta
  visual, no como defecto.
- **Nadie puede regenerar líneas base localmente.** Un contribuidor de un
  fork depende de que un maintainer aterrice el commit de seguimiento.
- La técnica de D2 depende de `#vitest-tester`, un identificador **interno**
  de `@storybook/addon-vitest` que puede cambiar sin aviso en cualquier bump.
  El `try`/`catch` evita el crash, pero el resultado sería un cuadro de
  960 × 720 y las 38 comparaciones en rojo a la vez.
- La corrida visual también re-ejecuta axe sobre las mismas 38 historias
  —costo duplicado aceptado, y el precio del invariante "entorno idéntico"
  de `vitest.shared.ts`.

**Neutras**

- El paso `test:visual` (la puerta positiva) se difirió deliberadamente al
  commit de seguimiento: agregarlo antes habría dejado CI en rojo hasta que
  alguien despachara el workflow. Las dos puertas negativas sí quedaron
  cableadas desde esta slice, porque siembran su propia fixture y son
  autocontenidas. **Cerrado con evidencia (2026-08-19)**: el primer despacho
  de `visual-baselines.yml` (run `32303795159`, exitoso, 9m58s) generó las
  38 líneas base `-chromium-linux`, commiteadas en `3628e9b`, y desde ese
  aterrizaje `ci.yml` corre `test:visual` como paso final del job `ci`.
- Las capturas fallidas dejan PNGs en `.vitest-attachments/`, ignorado por
  git desde esta slice.

## Seguimiento (decisiones diferidas)

- **Incrustar Inter auto-hospedada.** Es el arreglo estructural de fondo: sin
  glifos re-rasterizados por el sistema operativo, las líneas base locales o
  en contenedor volverían viables y el costo de los contribuidores de forks
  desaparecería. Es el único cambio que relaja D7 sin aflojar el umbral.
- **Ampliar la matriz** a los anillos de foco, los cuatro cruces de overlay
  que faltan y los temas oscuro y alto contraste. Disparador: el plumbing de
  decorator/`globalTypes`, que a su vez exige resolver primero los huecos de
  contraste que ADR-0006 D3 registró, para no poner en rojo la puerta de
  accesibilidad existente.
- **Agregar el paso `test:visual` a `ci.yml`** — cerrado (2026-08-19) con el
  primer despacho del workflow; la evidencia queda registrada en Neutras.
- **Revisar la dependencia de `#vitest-tester`** en cada bump de
  `@storybook/addon-vitest`: si el identificador o el `transform: scale(0,8)`
  cambian, D2 necesita re-medición, no un parche a ciegas.
