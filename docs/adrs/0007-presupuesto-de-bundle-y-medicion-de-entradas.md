# ADR-0007: Presupuesto de bundle sobre una entrada de consumidor empaquetada, y su punto ciego admitido

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-17 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0001` (D3, split cliente/servidor); `ADR-0004` (D4 "derivar, nunca listar a mano"; G5/G6); `ADR-0006`; `CONSTITUTION.md` — RNF-02, RNF-05, Principio 2, Principio 4 |

## Contexto

RNF-02 exige que integrar el sistema no degrade los Core Web Vitals del
consumidor. Hasta esta slice ese requisito no tenía ningún gate: nada en CI
medía cuántos bytes gzip paga realmente una aplicación que importa
`@zevaui/components`, ni fallaba cuando esa cifra creciera sin control.

`react-aria-components` es la dependencia dominante del paquete. Medido con
esbuild (`--bundle --minify --format=esm`, `react`/`react-dom`/
`react/jsx-runtime` externos), el barrel completo (`export * from
"@zevaui/components"`) pesa **56.849 B gzip**, y `react-aria-components`
representa **el 95 % de ese peso** (código propio de zevaui: ~3,01 KB gzip).
Cualquier presupuesto que no mida a través de esa dependencia vigila una
fracción irrelevante del costo real.

esbuild 0,25.12 ya estaba instalado — 88 referencias en `pnpm-lock.yaml` —
pero solo de forma transitiva vía Vite, sin resolver desde la raíz del
repositorio. Un gate de CI no puede alcanzar los internos de pnpm para
invocarlo.

## Decisión

### D1. El presupuesto se declara sobre una entrada de consumidor empaquetada, no sobre `dist/**`

`packages/components/scripts/check-bundle-budget.js` bundlea una entrada
real (`export { Card } from "@zevaui/components"`, por ejemplo) con esbuild,
alias apuntando a `dist/index.js`, `react`/`react-dom`/`react/jsx-runtime`
externos, y mide el gzip resultante con `node:zlib.gzipSync` a nivel 9. Este
es el número que un consumidor real paga al importar el paquete — no el peso
de los artefactos de `dist/**`, que incluyen sourcemaps y tipos que nunca
llegan al navegador.

### D2. esbuild se declara como `devDependency` explícita

`packages/components/package.json` gana `esbuild` como `devDependency`
declarada (`^0.25.12`, la versión transitiva ya instalada). Es la primera
dependencia de tooling de build que el repositorio adopta para un gate; las
alternativas consideradas y descartadas están en la tabla de abajo.

### D3. Cuatro entradas derivadas del registro, con `imports` explícito como palanca declarada

`packages/components/bundle-budget.json` declara exactamente cuatro
entradas: una por cada componente `clientOnly: false` en `registry.ts` (hoy
`Card` y `Alert` — **derivadas**, nunca listadas a mano, siguiendo el mismo
principio que ADR-0004 D4 fija para `staticCss`), más `Button` (entrada
cliente representativa) y el barrel completo — ambas **declaradas**, porque
no tienen contraparte en el registro de la que derivarse.

Una entrada derivada ausente del JSON es un fallo, no un salto silencioso:
`bundle-budget.js`'s `budgetEntries()` lanza si un componente
`clientOnly: false` no tiene entrada correspondiente. Una entrada declarada
sin `imports` explícito y sin contraparte derivada es una entrada
obsoleta — también un fallo. Cualquier entrada declarada puede listar más de
un componente en `imports` (por ejemplo `["Card", "Button"]`); esta es la
palanca de una línea que D7 nombra como la reparación ya diseñada para su
propio punto ciego.

### D4. Los multiplicadores +25 % / +10 % son supuestos admitidos, no valores derivados

Las entradas `server` (derivadas del registro) reciben
`maxGzipBytes = ceil(measuredGzipBytes * 1,25)`; las entradas `client` y el
`barrel` reciben `ceil(measuredGzipBytes * 1,10)`. Ninguno de los dos
números se midió — son supuestos admitidos, y este documento los presenta
como tales, no como cifras derivadas. La regla que los justifica: el margen
debe ser menor que la clase de regresión más pequeña que la entrada existe
para atrapar. Para `Card`/`Alert` esa clase es "una importación de
react-aria se filtró al camino presentacional" (≈ +12,6 KB gzip contra una
base de 0,65/0,48 KB) — +25 % es ajustado y significativo. Para
`Button`/barrel la clase es "aterrizó una dependencia transitiva nueva",
cuya instancia mínima no está medida — +10 % queda señalado como un supuesto
a revisar en el primer aumento real de dependencias.

### D5. `measuredGzipBytes` + `measuredAtCommit` conviven con el techo; el diff del propio archivo es el libro mayor de RNF-05

Cada entrada de `bundle-budget.json` registra su techo (`maxGzipBytes`)
junto a su última medición (`measuredGzipBytes`, `measuredAtCommit`). `--record`
actualiza solo esos dos campos; nunca sobreescribe un `maxGzipBytes`
existente, porque un techo es una decisión humana, no una medición en vivo.
El propio `git diff` del archivo es entonces el registro de antes/después
que RNF-05 exige — no existe una bitácora de métricas separada.

Las cifras medidas reales que respaldan `bundle-budget.json` hoy (primera
corrida de `--record`, commit `98c91a6`):

| Entrada | Clase | Gzip medido | Techo (multiplicador) |
|---|---|---|---|
| `Card` | server | 673 B | 842 B (+25 %) |
| `Alert` | server | 494 B | 618 B (+25 %) |
| `Button` | client | 13.611 B | 14.973 B (+10 %) |
| barrel | barrel | 56.849 B | 62.534 B (+10 %) |

Estas son las cifras reales que el propio script midió al implementarse —
divergen en unos pocos bytes de la corrida de sondeo previa (spike), excepto
el barrel, que coincidió exactamente. El número del script gana siempre
sobre cualquier cifra de sondeo.

### D6. Tarea de turbo con `dependsOn: ["build"]`; el fixture negativo queda como paso crudo

`turbo.json` gana una tarea `size` real (`dependsOn: ["build"]`, porque lee
`dist/registry.js` y `dist/index.js`), con semántica de pass/fail normal y
caché de turbo. El fixture negativo (`size:gate`,
`scripts/assert-budget-fails.js`) se mantiene como paso crudo de CI, igual
que el gate de accesibilidad — ambos invierten deliberadamente un código de
salida, lo cual no tiene sentido dentro de un grafo de tareas de turbo.

### D7. El punto ciego — dicho sin adornos

**Con cuatro entradas, una regresión en `Menu`, `Dialog` o `Input` solo es
visible a través del techo del barrel, que `Menu` ya domina.** Medido por
sondeo (spike-portal-and-entries): `Menu` pesa **49,89 KB** de los
**55,52 KB** gzip del barrel — **~90 %**. `Dialog` pesa 25,06 KB e `Input`
12,06 KB. Una regresión de 5 KB en `Menu` es aproximadamente el 9 % del
barrel y **cabe dentro del +10 % de margen que D4 le concede al barrel: el
gate pasaría sin detectarla.**

Este es un hueco aceptado y documentado, no una cobertura fingida — sigue el
mismo precedente que `ADR-0004` y `ADR-0006` (D3) ya sentaron: nombrar un
hueco medido en la ADR en vez de esconderlo. **Disparadores de revisión**:
(a) una regresión del barrel que ninguna de las cuatro entradas explique;
(b) el momento en que aterrice un quinto componente cliente. La reparación
ya está diseñada y es de una línea: declarar entradas `Menu`/`Dialog`/
`Input` con `imports` explícito en `bundle-budget.json` (ver D3).

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| Presupuesto sobre `packages/components/dist/**` (`node:zlib` sin bundlear) | Vigilaría el ~5 % del costo real: `react-aria-components` es el 95 % del gzip del barrel. Los sourcemaps y los tipos del tarball tampoco son costo de runtime del consumidor. |
| `size-limit` | Ausente del `pnpm-lock.yaml` (cero coincidencias); sería la primera dependencia de tooling de build donde el repositorio ya tiene la convención de scripts Node sin dependencias (`build-manifest.js`, `tokens/scripts/build.js`). |
| Invocar el esbuild transitivo por su ruta `.pnpm` interna | Un gate de CI no debe alcanzar los internos de gestión de paquetes de pnpm; esbuild está instalado pero no resuelve desde la raíz del repositorio sin declararlo. |
| rolldown (presente solo transitivamente) | El mismo problema de resolución que esbuild sin declarar, y sin la API `stdin` + `alias` que aquí evita escribir archivos temporales en disco. |
| Semántica de snapshot con margen cero | Más fiel a "la gobernanza es el producto" y haría exacto a RNF-05, pero convierte cada bump del lockfile en un CI rojo de dos pasos. Se conserva la columna `Δ ledger` del reporte para no perder esa señal sin imponer el costo. |
| Una entrada por componente (seis, en vez de cuatro) | El usuario la rechazó a favor de cuatro entradas derivadas + declaradas; el costo real de esa elección se registra en D7 en vez de ocultarse. |
| Enumerar las entradas a mano | Un componente `clientOnly: false` nuevo entraría al paquete sin techo declarado. Las entradas derivadas ausentes son un fallo del gate, no un salto silencioso. |

## Consecuencias

**Positivas**

- RNF-02 tiene ahora un gate real: `pnpm turbo run size` falla y nombra cada
  entrada que exceda su techo, con caché de turbo normal.
- El presupuesto mide lo que un consumidor real paga (vía `react-aria-components`
  externalizado solo en React/React-DOM), no un proxy parcial sobre `dist/**`.
- `Card` sigue funcionando como guarda de regresión de tree-shaking: se
  mantiene sub-KB solo mientras el camino presentacional queda libre de
  importaciones de react-aria.
- El fixture negativo (`__fixtures__/budget-over.json` +
  `scripts/assert-budget-fails.js`) prueba dos condiciones independientes:
  que la comparación tiene dientes (techo imposible en `Card`) y que la
  medición discrimina el grafo de importaciones real, no solo aritmética
  sobre un número recordado (`CardAndButton`, medido contra el techo de
  `Card` en solitario).

**Negativas / costos**

- **El punto ciego de D7 es real y queda sin gate en esta slice**: una
  regresión de hasta ~9 % del barrel en `Menu` específicamente pasaría sin
  ser detectada por ninguna de las cuatro entradas actuales.
- Los multiplicadores +25 % / +10 % son supuestos, no mediciones — quedan
  correctamente etiquetados como tales, pero eso significa que ninguno de
  los dos está validado contra una regresión real todavía.

**Neutras**

- esbuild pasa de dependencia transitiva no declarada a `devDependency`
  explícita — mismo binario, ahora con resolución de módulos garantizada
  desde la raíz del paquete.

## Seguimiento (decisiones diferidas)

- **Cerrar el punto ciego de D7**: declarar entradas `Menu`, `Dialog` e
  `Input` en `bundle-budget.json` con `imports` explícito, usando la misma
  mecánica de detección de grafo ya probada por el fixture negativo
  (`CardAndButton`). Disparador: una regresión del barrel que ninguna de las
  cuatro entradas actuales explique, o el aterrizaje de un quinto componente
  cliente.
- **Revisar los multiplicadores +25 % / +10 %** contra el primer bump real
  de dependencias que los ejercite, en vez de dejarlos como supuestos sin
  validar indefinidamente.
