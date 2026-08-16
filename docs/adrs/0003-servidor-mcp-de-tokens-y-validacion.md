# ADR-0003: Servidor MCP de tokens y validación

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0001` (D8); `ADR-0002` (D1, `packages/mcp`); `@zevaui/constraints` |

## Contexto

El ADR-0001 (D8) definió que `@zevaui/mcp` expondría componentes y tokens a
agentes vía el SDK oficial de TypeScript, listando seis herramientas:
`list_components`, `get_component`, `search_tokens`, `get_token`,
`list_themes`, `validate_theme`. Al implementar ese paquete hubo que resolver
decisiones que D8 dejó abiertas: cuáles de esas seis herramientas son
realmente construibles hoy, qué versión del SDK usar, si los tokens se
exponen como *tools* o como *resources*, cómo evitar que el id de tema en
kebab-case (`high-contrast`) y la clave JS en camelCase (`highContrast`)
diverjan, cómo tipar el export de tokens, y si este es el momento de exponer
un registro compatible con `shadcn`.

## Decisión

### D1. Se implementa 1 de las 6 herramientas de D8: `validate_theme`

`list_components` y `get_component` necesitan `components.manifest.json`,
que el propio ADR-0001 deja en Seguimiento — no existe todavía. Publicar
esas dos herramientas como *stubs* que no devuelven nada sería peor que no
exponerlas: un agente vería la capacidad anunciada y confiaría en ella. Las
otras tres quedan subsumidas por decisiones posteriores de este mismo ADR:
`search_tokens` y `get_token` por los *resources* de tokens (D3), y
`list_themes` por el hecho de que `resources/list` ya enumera los tres temas
sin necesidad de una herramienta dedicada.

### D2. SDK de MCP v1 (`@modelcontextprotocol/sdk@1.30.0`), solo stdio

Se eligió el SDK v1 unificado sobre los paquetes v2 separados
(`@modelcontextprotocol/server`/`client@2.0.0`) por compatibilidad de hosts:
hoy no hay ningún consumidor real de este servidor, y v1 es el que los hosts
existentes (Claude Desktop, editores con soporte MCP) integran de forma
probada. El transporte es únicamente stdio; no se expone HTTP.

**Consecuencia medida:** instalar el SDK v1 agrega **64 paquetes
transitivos** que no estaban en el lockfile por ningún otro paquete del
monorepo — entre ellos `express`, `hono`, `cors`, `jose`, `ajv`,
`express-rate-limit` y `eventsource`. Es decir, una pila HTTP completa viaja
como dependencia de runtime de un paquete que solo usa stdio, porque el SDK
v1 no separa el transporte stdio del transporte HTTP en el empaquetado. Este
número (64) es el disparador concreto para revisitar la migración a v2 en
cuanto exista un consumidor real: en ese momento el costo de invalidar
`peerDependencies`/imports por el split de paquetes se compensa con el peso
retirado.

### D3. Los tokens se exponen como *resources*, no como *tools*

Los recursos son la primitiva de datos de solo lectura del protocolo; las
herramientas implican efectos secundarios y consumen el presupuesto de
llamadas a herramientas del modelo. Los tres temas se publican como recursos
estáticos (`zevaui://tokens/{light,dark,high-contrast}`), que
`resources/list` auto-puebla — precisamente lo que vuelve redundante una
herramienta `list_themes`.

### D4. El mapa kebab/camel de ids de tema es un export generado de `@zevaui/tokens`

`themeIds` y `themeKeyOf` no se escriben a mano en `@zevaui/mcp`: son datos
derivados que `packages/tokens/scripts/build.js` ya calcula al construir los
temas. Generarlos ahí hace que el *bucket* acumulador y el mapa exportado
sean el mismo objeto, así que la divergencia entre `high-contrast` (id
kebab-case usado en la URI y en el enum del tool) y `highContrast` (clave del
objeto de tokens en JS) deja de ser posible por construcción, en vez de
meramente improbable. Como efecto colateral, esto eliminó el duplicado de
este mismo mapa que vivía en un test de Stage 3.

### D5. `theme` en `validate_theme` es un enum cerrado, no un string libre

`validateThemeRequest`/`validateTheme` usan `theme` únicamente para resolver
el umbral vía `minContrastRatioFor`. Con un string libre, un id mal escrito
(por ejemplo `"hight-contrast"`) no lanza error: valida silenciosamente
contra el umbral de 4.5:1 en vez de 7.0:1 y devuelve `pass: true` sobre una
paleta que en realidad no cumple AAA. Un enum cerrado (`z.enum(themeIds)`)
elimina esa clase de fallo por construcción — el error ocurre en la
validación del esquema, antes de llegar a la lógica de contraste — en vez de
limitarse a reportarlo después.

### D6. El `.d.ts` de tokens emite un `type`, no una `interface`

TypeScript concede *index signatures* implícitos a los alias de tipo
(`type`) pero nunca a las interfaces. El tipo `Theme.colors` de
`@zevaui/constraints` es `Readonly<Record<string, string>>`; una `interface`
generada con una propiedad por token no satisface esa firma aunque las claves
coincidan, porque a una interfaz no le basta con tener las propiedades
correctas — necesita declarar explícitamente el índice. Se verificó con una
prueba real de `tsc --noEmit --strict`: la versión `interface` falla la
asignación, la versión `type` pasa.

### D7. Se difieren los componentes y cualquier registro compatible con `shadcn`

La razón es estructural, no de esfuerzo: el `registry-item.json` de `shadcn`
declara `cssVars` con exactamente **dos** *buckets* de tema (`light`,
`dark`). Zevaui tiene **tres**, y el tercero no es una variante cosmética —
`high-contrast` es un compromiso AAA de 7.0:1 que hoy pasa en 7.09:1 (1.3%
de margen). Aplanar tres *buckets* en dos obliga a elegir entre descartar esa
garantía o reetiquetarla silenciosamente como si fuera una variante más de
`dark`. Ninguna de las dos opciones es aceptable sin una decisión explícita
de compatibilidad, así que este trabajo queda fuera de esta ADR.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| Publicar `list_components`/`get_component` como *stubs* | Anuncian una capacidad que no devuelve nada; peor que no exponerla — un agente confía en lo que ve listado. |
| SDK de MCP v2 (`@modelcontextprotocol/server`/`client@2.0.0`) | Paquetes divididos, sin consumidores reales hoy que dependan de esa API; peor compatibilidad probada con hosts existentes. |
| Tokens como *tools* (`get_token`, `search_tokens`, `list_themes`) | Los *resources* estáticos ya auto-pueblan `resources/list`; una *tool* implica efectos secundarios y consume presupuesto de llamadas del modelo. |
| Mapa kebab/camel escrito a mano en `@zevaui/mcp` | Duplicaría un cálculo que `scripts/build.js` ya hace; ese duplicado vivía en un test de Stage 3 y ya se eliminó. |
| `theme` como string libre en `validate_theme` | Un id mal escrito valida `high-contrast` contra 4.5:1 en vez de 7.0:1 y devuelve `pass: true` — falso positivo silencioso. |
| `tokens.d.ts` con `interface` | TypeScript no concede *index signatures* implícitos a interfaces; no satisface `Theme.colors: Readonly<Record<string, string>>`. Verificado con `tsc --noEmit --strict`. |
| Registro compatible con `shadcn` ahora | `cssVars` de `shadcn` solo admite dos *buckets* (`light`/`dark`); Zevaui tiene tres, y el tercero es un compromiso AAA de 7.0:1, no una variante cosmética. |

## Consecuencias

**Positivas**

- Un agente que consulta este servidor obtiene exactamente lo que existe:
  cero herramientas fantasma, tokens resueltos y validables de punta a
  punta.
- El mapa kebab/camel y el tipado de tokens son imposibles de desincronizar
  por construcción (generados, no escritos a mano).
- `validate_theme` no puede validar silenciosamente contra el umbral
  equivocado.

**Negativas / costos**

- El SDK v1 agrega 64 paquetes transitivos de una pila HTTP no usada
  (`express`, `hono`, `cors`, `jose`, `ajv`, `express-rate-limit`,
  `eventsource`), pura carga de superficie e instalación.
- Solo 1 de las 6 herramientas que D8 anunció está implementada; la
  fidelidad respecto a esa decisión original es parcial.
- No hay interoperabilidad con el registro de `shadcn`: un consumidor que
  espera `registry-item.json` no encuentra nada aquí todavía.

**Neutras**

- El caveat de `@zevaui/constraints` (WCAG 1.4.11 no enforced) se hereda sin
  cambios: `validate_theme` no lo cierra ni lo empeora.

## Seguimiento (decisiones diferidas)

- Migrar al SDK de MCP v2 en cuanto exista un consumidor real que justifique
  absorber el costo del split de paquetes (disparador: los 64 paquetes de
  D2 dejan de ser un costo aceptado en silencio).
- `components.manifest.json` y, con él, `list_components`/`get_component`
  (ver ADR-0002, Seguimiento).
- Diseño explícito de compatibilidad con el registro de `shadcn` que decida
  cómo representar el tercer *bucket* (`high-contrast`) sin perder ni
  reetiquetar el compromiso de 7.0:1.
