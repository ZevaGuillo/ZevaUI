# ADR-0009: Auditoría de uso como reusable workflow, con escáner propio y sin red

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-20 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0002` (D6, que ya comprometió `uses: zevaui/design-system/.github/workflows/audit-ds-usage.yml@v1`); `ADR-0007` (precedente de puerta con fixture negativo); `CONSTITUCION.md` — RF-11, §6.4 Mecanismo A |

## Contexto

RF-11 es el único lazo de gobernanza que responde "qué app corre qué versión,
usando qué componentes". `ADR-0002` D6 ya había fijado la forma de invocación,
pero asumía un registry, un modelo de auth y un paquete publicado que no
existen.

La decisión de fondo fue no construir nada de eso todavía. Un audit que
depende de red, credenciales y un servicio vivo tiene tres formas nuevas de
fallar antes de reportar un solo dato. Sin red, la única forma de fallar es
leer mal el código del consumidor — y esa se puede probar contra un fixture
con respuesta conocida.

El riesgo real de esta pieza no es que se rompa. Es que **subcuente en
silencio**: `components[]` vacío, exit 0, ninguna advertencia. Un audit que se
ve limpio y no escaneó nada es peor que uno que no corre, porque nadie va a
mirarlo dos veces. Todo lo que sigue está ordenado alrededor de eso.

## Decisión

### D1 — Reusable workflow, no acción publicada

`.github/workflows/audit-ds-usage.yml` con `on: workflow_call` únicamente, sin
`push` ni `pull_request` ni `workflow_dispatch`. Este archivo existe para ser
invocado por OTROS repositorios; un trigger propio lo haría correr contra este
repo sin caller y sin significado.

`packages/audit` queda `private: true` y sin build (RF-UAW10). El escáner son
cuatro módulos Node sin dependencias que solo importan `node:` y entre sí, así
que un checkout ES la instalación completa. Esa propiedad se defiende: es lo
que impide que este workflow ejecute el lockfile de un consumidor.

### D2 — Sin red (RF-UAW09)

El reporte se publica por `actions/upload-artifact` y `$GITHUB_STEP_SUMMARY`.
Ninguna llamada HTTP saliente. `permissions: contents: read` y nada más: este
workflow lee fuente ajena y emite un reporte, nunca necesita escribir en el
repositorio del consumidor, y un token que no puede escribir es la única
prueba durable de eso.

### D3 — El `ds-ref` es obligatorio y sin default

El reporte dice qué versión del DS usa el consumidor, pero **no dice qué
escáner lo produjo**. Un `ds-ref` sin pin haría que dos corridas idénticas
significaran cosas distintas sin que nada cambie a la vista. Se pina igual que
se pina el workflow.

### D4 — `.zevaui-audit` es un contrato entre el YAML y el escáner

El workflow checkoutea este design system DENTRO del workspace del consumidor.
Con `working-directory: "."` el walk entra ahí y reporta como propios los
componentes que importa nuestro Storybook.

**Medido**: un consumidor que usaba solo `Button` recibió `Alert, Button,
Dialog`.

Por eso `WORKFLOW_DS_CHECKOUT_DIR` en `walk-source-tree.js` y el `path:` del
segundo checkout tienen que ser idénticos. Cambiar uno sin el otro suma
nuestros componentes al reporte de cada consumidor, en silencio. Está cubierto
por test unitario.

### D5 — Techo del parser, declarado y asertado ausente (RF-UAW05)

El escáner es un lexer de dos etapas, no un parser de TypeScript. La etapa 1
blanquea comentarios, strings, template literals y regex preservando offsets;
la etapa 2 ubica los `import` reales en el texto saneado.

Fuera de alcance en esta versión, y **asertado ausente** en el fixture, no
funcionando por accidente: import de namespace, `import()` dinámico, import
type-only, subpaths más allá de los tres exports declarados, y **re-exports de
barril** (`export { Button } from "@zevaui/components"`).

El re-export se suma a la lista en este ADR: no estaba en los tres huecos que
`ceiling.tsx` documenta y lo encontró la lente de fiabilidad del review. Es un
patrón común y hoy contribuye cero.

La heurística regex-vs-división es deliberadamente asimétrica: ante la duda
elige división. Blanquear código real borra un import genuino y el audit
reporta éxito con lista más corta — silencioso. Dejar una regex sin blanquear
a lo sumo produce un componente fantasma — ruidoso, se nota. Cuando hay que
adivinar, se adivina hacia el error ruidoso.

Spike S-B corrido contra 32 archivos reales y no planificados de este repo:
cero crashes, cero desajustes de longitud, cero falsos positivos.

### D6 — Todo salto no leído se NOMBRA

`skipped[]` nombra todo lo que el walk no pudo leer: symlinks (nunca se
siguen), directorios ilegibles, entradas que no son archivo, archivos sobre el
tope de 1 MB y archivos que fallaron al leerse.

Deliberadamente NO nombra directorios podados ni extensiones fuera del
allowlist: son exclusiones documentadas y estables, y contarlas ahogaría la
única señal que ese array transporta.

El walk vive en su propio módulo con la superficie de filesystem inyectable.
No es indirección por gusto: ninguno de los dos saltos que mentían se puede
producir de forma portable —Windows rechaza `symlinkSync` con EPERM, y un
directorio ilegible no tiene receta portable— así que sin esa costura las dos
rutas quedaban sin test en las máquinas donde se desarrolla este repo.

### D7 — Inputs vacíos, no ausentes

GitHub Actions pasa un input omitido de `workflow_call` como **string vacío**,
nunca como variable sin definir. `??` no cae al default con `""`, así que cada
default del entry sería código muerto alcanzable solo a mano.

El entry normaliza blanco a ausente, y mantiene separadas dos preguntas
distintas: "¿el caller nombró esta app?" (lo que pregunta el guardia de
identidad) y "¿con qué etiquetamos el reporte?". Colapsarlas dejaría que el
fallback a `github.repository` satisficiera el guardia y etiquetara el reporte
de un subdirectorio con el nombre del repositorio entero.

### D8 — `dsVersion` en cascada, con procedencia declarada

Enmienda RF-UAW07. Se prefiere la versión instalada exacta
(`node_modules/@zevaui/components/package.json#version`); si no hay
`node_modules`, se cae al rango declarado (`dependencies` →
`devDependencies` → `peerDependencies`); si no hay ninguno, falla cerrado.

El reporte gana una quinta clave, `dsVersionSource` (`"installed" |
"declared"`), porque la cascada mentiría por omisión entre un `"1.2.3"` exacto
y un `"^1.2.0"` meramente declarado.

## Divergencias respecto del spec, registradas

| Spec | Lo entregado | Por qué |
|---|---|---|
| RF-UAW01 — cuatro claves | Cinco: se agrega `dsVersionSource` | D8; sin ella la cascada miente por omisión |
| RF-UAW07 — solo versión instalada | Cascada instalada → declarada → falla cerrado | D8; `node_modules` no siempre está presente en el runner del consumidor |
| RF-UAW08 — input `app-name` obligatorio | Input `app`, opcional, con default `github.repository` | El default se rechaza justo en la configuración donde es probable que esté mal: `working-directory` distinto de `"."` sin app explícita. Dos invocaciones con apps distintas siguen produciendo dos reportes distintos, que es lo que RF-UAW08 protege |

## Consecuencias

Un consumidor agrega el workflow en un bloque y obtiene un artefacto JSON y una
tabla en el step summary. No necesita instalar nada, no necesita credenciales,
y el workflow no puede escribir en su repo.

El texto controlado por el consumidor (`dsVersion` viene de SU `package.json`,
`app` de un input) llega a Markdown renderizado, así que se escapan pipes y las
tres formas de terminador de línea antes de entrar a la tabla. Los inputs
llegan al shell por `env:`, nunca interpolados dentro de un `run:`.

## Hueco residual — RF-UAW14, nombrado y no cubierto

**La auto-invocación `workflow_call` dentro de este mismo repositorio NO prueba
la resolución cross-repository de `uses: zevaui/design-system/...@v1`, ni el
camino de publicación del tag.**

El job `audit-self` de `ci.yml` prueba los inputs, la subida del artefacto y la
salida del step summary, todo por la ruta local `./.github/workflows/...`. Eso
es evidencia real sobre el workflow, y no es evidencia sobre lo único que un
consumidor externo hace distinto: resolver el `uses:` contra otro repositorio,
en un tag publicado, con los permisos de ESE repositorio.

Se suma una segunda limitación medida en el mismo lugar: `audit-self` pasa
`github.event.pull_request.head.sha` como `ds-ref`, que es una rama del mismo
repositorio. Un PR desde un fork no encontraría ese ref en el repo base.

**Disparador para cerrarlo**: un consumidor externo real invocando el workflow
publicado (D1). Hasta que eso ocurra y su corrida se inspeccione, este camino
está sin probar y así queda registrado — no implicado como cubierto.
