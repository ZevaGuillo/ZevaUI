# ADR-0006: `Card` y `Alert`: el roster core completo, y los dos primeros componentes server-renderable

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-17 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0001` (D3, D8); `ADR-0004` (contraste de `color-border-strong`); `ADR-0005` (D2, D4); `@zevaui/constraints`; `CONSTITUCION.md` — RF-05, RF-07, RNF-01 |

## Contexto

`Card` y `Alert` cierran el roster mínimo de seis componentes que RF-05
exige. Los cuatro anteriores (`Button`, `Input`, `Dialog`, `Menu`) son todos
client-side: cada uno envuelve `react-aria-components` o un hook propio.
Ninguno probó nunca la otra mitad de la decisión que ADR-0001 (D3) ya había
tomado — "los presentacionales puros quedan server-renderables" — porque
hasta esta slice no existía un componente presentacional puro que la
ejerciera.

Eso deja tres preguntas abiertas que ninguno de los cuatro componentes
anteriores obligó a responder:

1. `Card` es multi-parte, igual que `Dialog` y `Menu`. ADR-0005 (D4) decidió
   que esos dos exponen props de contenido tipadas, no composición por
   `children`. ¿`Card` tiene que seguir el mismo patrón, o hay un motivo real
   para divergir?
2. `Alert` necesita comunicar tono (`danger` / `success` / `warning`) sin
   depender solo del color. ¿Qué combinación de texto y color pasa WCAG 2.2
   AA en los tres tonos, medida contra los tokens reales?
3. `Alert` dibuja un borde de acento coloreado por tono. `color-border-strong`
   —el único neutro suficientemente fuerte que el sistema publica— ya falla
   WCAG 1.4.11 (ADR-0004). El borde de acento de `Alert` usa el color de tono,
   no ese neutro: ¿pasa 1.4.11, y en qué temas?

## Decisión

### D1. `Card` compone con slots mientras `Dialog` y `Menu` usan props de contenido tipadas — y eso no es una inconsistencia

El razonamiento de ADR-0005 (D4) es semántico y específico de los overlays,
no una regla general contra la composición por `children`:

- `role="menu"` solo admite hijos `menuitem`.
- La colección de react-aria necesita una clave estable por renglón.
- `MenuTrigger` deriva el nombre accesible del menú desde el propio trigger.

Exponer esas costuras en `Dialog` o `Menu` exportaría **estructura**, no
contenido — el consumidor podría romper un contrato ARIA que el componente
tiene que sostener. `Card` no tiene ninguna de esas tres restricciones: no
declara rol ARIA, no gestiona una colección de react-aria y no deriva un
nombre accesible de nada. Sus zonas (`Card.Header`, `Card.Body`,
`Card.Footer`) son contenido arbitrario que un consumidor no puede romper
estructuralmente, sin importar qué ponga ahí dentro.

**La regla que decide los casos futuros**: props tipadas donde la estructura
ARIA es la que sostiene la semántica del componente (un rol, una colección,
un nombre accesible derivado); composición por slots donde no lo es. No es
"componentes multi-parte usan X" — es "¿qué puede romper el consumidor si
arma la estructura él mismo?".

### D2. El texto de `Alert` es neutro en los tres tonos; el color es un acento no textual

El diseño obvio —texto `{tone}.default` sobre fondo `{tone}.subtle`— se
midió contra los valores OKLCH reales de `@zevaui/tokens` (tema `light`,
`packages/constraints/src/color/contrast.ts`) y **se rechazó**: falla el
piso de 4.5:1 de WCAG AA en los tres tonos.

| Diseño rechazado | danger | success | warning | Piso |
|---|---|---|---|---|
| `{tone}-default` sobre `{tone}-subtle` | 3.90 | 2.93 | 1.93 | 4.5:1 |

El diseño elegido —`color-text-default` (neutro) sobre `{tone}-subtle`— pasa
con margen amplio en los tres:

| Diseño elegido | danger | success | warning | Piso |
|---|---|---|---|---|
| `color-text-default` sobre `{tone}-subtle` | 14.54 | 16.14 | 15.94 | 4.5:1 |

Las dos tablas están **re-verificadas para esta ADR** contra
`packages/tokens/tokens/{primitives/colors,themes/light}.json`, no solo
copiadas del comentario de `alert.recipe.ts`. El color de tono queda
entonces como un acento no textual únicamente: el borde de acento del lado
`inline-start` (ver D3). El texto nunca cambia de color entre tonos.

### D3. El déficit WCAG 1.4.11 del borde de acento queda registrado, no arreglado

El borde de acento de `Alert` usa `{tone}.default` sobre `{tone}.subtle` — el
mismo par que D2 rechazó para texto, pero aquí como color de un borde de 4px,
no de letras. Medido en los tres temas base:

| Tema | danger | success | warning |
|---|---|---|---|
| light | 3.90 ok | **2.93 FAIL** | **1.93 FAIL** |
| dark | **2.63 FAIL** | 4.08 ok | 5.29 ok |
| high-contrast | 5.26 ok | 4.50 ok | 6.41 ok |

(Piso WCAG 1.4.11: 3.0:1. Los nueve valores están re-derivados para esta ADR
contra los primitivos y los tres temas reales, no asumidos.)

**Fallan exactamente 3 de 9 combinaciones, y abarcan tanto `light` como
`dark`** — no es un problema exclusivo de un tema. Decirlo así importa:
tratarlo como "el tema claro está mal calibrado" invitaría a "arreglarlo"
tocando la escala de un solo tema, cuando el patrón real es que cada tema
tiene su propia combinación tono/fondo débil, no un tema entero débil.

**Ningún gate del repo atrapa esto.** `addon-vitest` corre la regla
`color-contrast` de axe sobre lo que Storybook renderiza, y esa regla evalúa
texto, no bordes decorativos — el mismo límite que ADR-0004 ya documentó
para `color-border-strong`. `@zevaui/constraints` tampoco lo cubre: su
`contrastPairs` valida pares texto/fondo (ver `src/contract.json`), y un
borde no es ninguno de los dos lados de esos pares.

**Es aceptable porque el borde es decorativo.** El tono de `Alert` no
depende de él para comunicarse: el `role` (`alert` / `status`, derivado del
`tone`, nunca una prop) y el texto llevan el significado completo. WCAG 1.4.1
(No usar solo el color) se sostiene sin el borde. Esto sigue el mismo
precedente que ADR-0004 ya sentó para `color-border-strong`: un hueco de
1.4.11 medido, documentado y dejado abierto a propósito, no escondido.

### D4. `Alert` no tiene tono por defecto ni tono `info`

Sin `defaultVariants` en el eje `tone` — a diferencia de `visual: "solid"` en
`Button`, que es un default neutro seguro. Un `Alert` sin tono declarado es
un bug del caller, no un caso para un fallback silencioso: un default
elegiría un significado semántico ("esto es una advertencia") que quien
llama nunca afirmó. `alert.types.ts` hace `tone` un prop `string` requerido
por el mismo motivo — omitirlo es un error de compilación, no un fallback en
runtime.

Sin tono `info`: verificado contra `@zevaui/tokens`, no existe ningún token
`color-info-*` ni `color-neutral-*` en ningún tema. La variante sigue al
token, nunca al revés — no se inventa un cuarto tono sin nada semántico que
lo respalde.

### D5. `Card` y `Alert` son los dos primeros componentes server-renderable

Completan la mitad de ADR-0001 (D3) que hasta ahora solo tenía demostrado el
lado client: "los componentes interactivos (RAC) son client-side; los
presentacionales puros quedan server-renderables". Ninguno de los dos toca
`react-aria-components` ni un hook, así que ninguno lleva la directiva
`"use client"` (`Card.tsx`, `Alert.tsx`). El manifest generado lo confirma:
`clientOnly: false` para ambos, contra `clientOnly: true` para los cuatro
anteriores (`dist/components.manifest.json`).

Esto es también lo que hizo necesario endurecer G6 (ver
`__tests__/emit-gates.test.ts`): hasta que existieron `Card` y `Alert`, todo
componente registrado era client, así que la mitad "NO lleva la directiva"
del gate nunca se había ejercido contra un dato que pudiera variar de verdad
— solo estaba probada, por copia manual, componente por componente. G6 ahora
es un único gate impulsado por el registro (`componentRegistry`), asertando
**las dos direcciones** contra un campo `clientOnly` declarado por
componente, y cubre automáticamente cualquier séptimo componente sin que
nadie tenga que copiar un bloque de test.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| `Card.Header`/`Card.Body`/`Card.Footer` como props de contenido tipadas, igual que `Dialog`/`Menu` | `Card` no tiene rol ARIA, colección ni nombre accesible derivado que proteger — exigir tipado ahí agrega superficie de API sin ganar nada que RF-07 no tenga ya cubierto con slots. |
| Texto `{tone}.default` sobre `{tone}.subtle` en `Alert` | Medido: 3.90 / 2.93 / 1.93 contra un piso de 4.5:1 — falla en los tres tonos, no solo en uno. |
| Un `defaultVariants.tone` neutro (p. ej. `"info"` o el primero declarado) | Un default de tono es una elección semántica silenciosa; un `Alert` sin tono declarado debe ser un error de compilación, no una advertencia implícita. |
| Agregar un tono `info` | Cero tokens `color-info-*`/`color-neutral-*` existen en `@zevaui/tokens`; la variante seguiría sin nada que la respalde. |
| Subir el color del borde de acento a un tono más oscuro/saturado para pasar 1.4.11 en los 9 casos | Tocaría la escala de primitivos compartida por todo el sistema para resolver el borde decorativo de un solo componente; el disparador correcto es el seguimiento de `@zevaui/constraints`, no un parche local. |
| Dejar G6 como un bloque de test por componente | Un séptimo componente client u opcional no habría quedado cubierto hasta que alguien recordara copiar el bloque — exactamente el motivo por el que `emittedSlotClassNames` y `extractSlots` ya son derivados en vez de declarados a mano. |

## Consecuencias

**Positivas**

- El roster mínimo de RF-05 queda **completo**: seis componentes
  (`Button`, `Input`, `Dialog`, `Menu`, `Card`, `Alert`), los seis derivados
  de tokens.
- `@zevaui/components` queda en **159 pruebas repartidas en 12 archivos**,
  todas en verde (`pnpm turbo run test`). `Card` y `Alert` aportan 10 y 9
  pruebas propias; el resto del delta frente al conteo de ADR-0005 (139) es
  la consolidación de G6 (seis bloques por componente colapsados en uno,
  registry-driven) más la nueva dirección reversa de G5.
- La puerta de accesibilidad de Storybook queda en **44 stories en Chromium
  real, todas en verde** (39 previas + 3 de `Alert` + 2 de `Card`).
- El scoping de tokens por componente del manifest se prueba ahora con **dos
  componentes server-renderable**: `Card` reclama 6 tokens (`color-bg-surface`,
  `color-border-default`, `radius-card`, `shadow-card`,
  `space-card-{px,py}`), `Alert` reclama 14 — ninguno de los dos reclama un
  token que no aparece en su propio bloque de reglas
  (`dist/components.manifest.json`).
- G5 gana su dirección reversa (`__tests__/css-gates.test.ts`): además de
  "todo lo que el recipe declara tiene una regla", ahora también se verifica
  "toda regla de una sola clase que la hoja de estilos emite está declarada
  por algún recipe registrado" — la única aserción del repo capaz de
  detectar que la derivación de nombres de clase se quedó ciega a una regla
  real.

**Negativas / costos**

- **RNF-01 (WCAG 2.2 AA) sigue solo parcialmente satisfecha, y de una forma
  nueva.** El déficit de `color-border-strong` que ADR-0004 documentó ya
  existía; esta slice agrega un segundo déficit de 1.4.11, el del borde de
  acento de `Alert`, en 3 de 9 combinaciones tema/tono. No es un déficit
  nuevo introducido por descuido — está medido y aceptado por D3 — pero es
  honesto contarlo como un segundo costo, no una repetición del primero.
- El disparador para cerrar ese hueco de verdad (extender
  `@zevaui/constraints`) sigue sin ocurrir; ver Seguimiento.

**Neutras**

- `Card` y `Alert` reutilizan geometría existente (`radius.card`,
  `spacing.card.px/py`) en vez de tokens propios, siguiendo el mismo patrón
  que ADR-0005 (D3) ya sentó para los overlays: un alias de un token que ya
  existe no agrega superficie de contrato nueva.

## Seguimiento (decisiones diferidas)

- **Extender `contrastPairs` de `@zevaui/constraints`** con los pares
  `color-text-default` x `color-{tone}-subtle` que D2 eligió, para los tres
  tonos y los tres temas. Hoy esa combinación solo la cubre el escaneo de
  axe sobre las stories de Storybook (ADR-0004), y **solo para los tonos que
  una story efectivamente renderiza** — `Alert.stories.tsx` cubre los tres
  hoy, pero nada lo garantiza si una story se borra o un tono nuevo se
  agrega sin la suya. Meter el par en el contrato lo gatearía a nivel de
  token, en los tres temas, sin depender de qué story exista. Disparador:
  el primer cambio a un primitivo `red`/`green`/`amber` o a un fondo
  `subtle`, momento en el que re-verificar a mano deja de ser sostenible.
- **Cerrar de verdad el hueco de 1.4.11 del borde de acento** (D3): subir la
  escala de primitivos donde haga falta para que las 9 combinaciones pasen
  3.0:1, sin romper las validaciones de texto que `@zevaui/constraints` ya
  hace pasar. Comparte disparador con el punto anterior — es el mismo
  primitivo el que hay que tocar.
- **La pregunta del anuncio en montaje dinámico queda diferida, sin
  respuesta.** MDN confirma que un `Alert` presente desde la carga inicial
  de la página **no** se anuncia — un `role="alert"`/`role="status"` que ya
  existe cuando el lector de pantalla arranca no dispara nada. Si un
  `role="alert"` ya poblado que se monta dinámicamente (el caso real de uso
  de este componente: aparece después de una acción del usuario) se anuncia,
  **varía según el par navegador/lector de pantalla** y no está resuelto por
  ninguna medición de esta slice. Ningún artefacto de este repo puede
  afirmar que `Alert` "se anuncia al montarse" — no es cierto en general y
  no está verificado en particular. Responderla de verdad necesita un
  programa de prueba real con varios lectores de pantalla, no un spike de
  una tarde.
