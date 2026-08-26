# ADR-0020: MCP revisitado: la condición de ADR-0003 se cumplió, y propose_theme

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | `ADR-0003` (D1 aplazamiento, D2 SDK, D3 resources, D7 shadcn); `ADR-0001` D8 (manifest); `ADR-0017` (theme editor, consumidor de `propose_theme`); `packages/mcp`, `packages/constraints`, `packages/components` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido. Al implementarse, este documento
> reemplaza parcialmente a `ADR-0003` y debe marcarse la relación en ambos.

## Contexto: una condición de aplazamiento cumplida que nadie revisitó

`ADR-0003` D1 implementó 1 de las 6 herramientas del servidor MCP y difirió
`list_components`/`get_component` con una condición exacta: "necesitan
`components.manifest.json`... que no existe todavía", rechazando
explícitamente publicar stubs vacíos.

**La condición se cumplió.** El manifest existe
(`packages/components/dist/components.manifest.json`, generado por
`build-manifest.js` leyendo solo output de build — cumple el mandato de
`ADR-0001` D8 "nunca escanea fuente"), está expuesto como subpath export
real, y su shape (name, className, clientOnly, import, slots, variants con
axis/values/default, classNames, tokens) **alcanza** para las dos
herramientas tal como el ADR las imaginó. Nadie revisitó el aplazamiento, y
el README del MCP todavía afirma que el manifest "no existe" — deuda
documental doble, el mismo patrón que `ADR-0011` ya reconcilió dos veces.

Además se propone una herramienta que no estaba en la lista original:
`propose_theme(brandColor)` — recibir un color de marca y devolver una paleta
completa que pasa el contraste. Es lo que convierte el servidor de checkbox a
algo que un agente instalaría: "dame un tema con el azul de mi marca que
cumpla AA".

## Estado real verificado

- MCP hoy: SDK v1, transporte stdio, 3 resources de temas + 1 tool
  `validate_theme` (con `colors` opcional: sin colors self-checkea la paleta
  shipped).
- `search_tokens`/`get_token`/`list_themes` **no están bloqueadas sino
  subsumidas** por los resources (D3, deliberado): la revisita debe
  reafirmarlas, no revivirlas. El registro shadcn (D7) sigue diferido con
  razón estructural vigente. D2 deja el disparador de migración a SDK v2 en
  "cuando exista un consumidor real" — agregar tools no lo activa solo.
- Maquinaria de color en `packages/constraints/src/color/`: existen
  `contrastRatio`, `relativeLuminance`, `parseColor` (hex 3/6 y
  `oklch(L C H)`, matrices de Ottosson). **Ninguna exportada del paquete.**
  El "gamut clamp" es solo `clamp01` por canal — **no** hay gamut-mapping
  real, ni la inversa sRGB→OKLCH, ni serialización. Eso es lo que falta
  construir; la mitad del algoritmo existe, no más.

## Decisión propuesta

### P1. Desbloquear exactamente dos herramientas

`list_components` (name + resumen) y `get_component` (metadata completa),
leyendo el manifest vía dependencia workspace a `@zevaui/components` con
import del subpath JSON — no arrastra código React en runtime (sí instala
peerDeps: costo de instalación, no de runtime; copiar el manifest en build
generaría drift y se descarta). El campo `generated` (timestamp) queda
excluido de cualquier golden test.

### P2. `proposeTheme()` vive en `@zevaui/constraints`; el MCP solo registra la tool

El algoritmo pertenece junto al contract y a `validateTheme`, testeable sin
MCP y disponible para el theme editor y cualquier CLI sin pasar por el
protocolo. Evita convertir las primitivas de color en API pública nueva.

### P3. El algoritmo, con su hallazgo estructural

Hallazgo del contract: `color-accent-*`, `focus-ring`, `bg-subtle/muted` y
`border-*` **no aparecen en ningún par de contraste** — el brandColor entra
**intacto** a accent. Los pares (16 de texto + 5 no textuales) restringen
~17 tokens; el trabajo real es derivar neutrales y semánticos tintados con el
hue de marca que pasen los pares.

Esbozo: (a) parsear el brand (cubierto) y convertir a OKLCH — falta la
inversa sRGB→OKLab (~30 líneas, matrices publicadas); (b) brand a `accent-*`
con offsets de L; (c) fondos con hue del brand y chroma bajo; (d) por cada
foreground restringido, **búsqueda binaria sobre L** (hue y chroma fijos)
contra `contrastRatio` hasta cruzar el piso del par más exigente en que
participa — un token aparece en varios pares, así que se resuelve en **orden
topológico: fondos primero**, luego cada foreground contra su peor fondo.
Iteraciones fijas y redondeo estable de L para determinismo y goldens.

### P4. Colores imposibles: nunca ajustar el hue en silencio

Un amarillo puro no llega a 4.5:1 sobre blanco. El hue es identidad de marca:
no se toca sin avisar. Si con L en el extremo alcanzable (y chroma reducido
hasta 0 como fallback documentado) el par no cruza el piso, se devuelve el
par más cercano con `adjustments[]`/`warnings[]` explícitos — o se falla si
un flag `strict` lo pide. Nunca degradar en silencio: coherente con la
filosofía anti-colapso de D5.

### P5. Contrato de salida auto-validado

```
{ theme, validation: ValidationResult, adjustments: [{token, from, to, reason}], warnings: string[] }
```

donde `theme` es el shape exacto que `validateTheme` acepta, y la
auto-validación es obligatoria antes de devolver — dogfooding del validador:
`propose_theme` genera, `validate_theme` confirma, el mismo loop que el
theme editor cierra visualmente. Emite solo los tokens de color requeridos
(~17–25), no dimension/shadow/font.

## Plan de implementación (4–5 PRs ≤400 líneas)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | `list_components` + `get_component` + dep workspace + tests + **fix del README** | 250–350 |
| 2 | constraints: inversa sRGB→OKLCH + serialización oklch + tests golden/property | 200–300 |
| 3 | constraints: `proposeTheme` (binaria, orden topológico, adjustments/warnings) + tests (amarillo puro, negro, blanco, fuera de gamut) | 350–400 (candidato a dividirse) |
| 4 | MCP tool `propose_theme` + auto-validación + tests | 150–250 |
| 5 | Actualización documental: marcar la relación con `ADR-0003` | 100–150 |

## Alternativas consideradas

**Revivir `search_tokens`/`get_token`/`list_themes` como tools.** Descartada:
subsumidas por resources con razón vigente (D3); revivirlas duplicaría
superficie.

**`proposeTheme` dentro del MCP.** Descartada: lo vuelve intesteable sin
protocolo y lo esconde del theme editor.

**Ajustar el hue cuando el color no alcanza.** Descartada: identidad de marca;
el ajuste silencioso es la clase de degradación que D5 existe para prohibir.

**Copiar el manifest al paquete MCP en build.** Descartada: drift.

## Riesgos

1. **Mayor — técnico**: monotonicidad no estricta de L→luminancia cerca del
   borde de gamut (`clamp01` aplana los extremos): la búsqueda binaria debe
   detectar no-cruce y activar el fallback de reducción de chroma o el
   warning, nunca oscilar.
2. Acoplamiento de pares (un token en cinco pares): sin orden topológico,
   ajustar un par rompe otro.
3. Determinismo float: iteraciones fijas + redondeo estable lo hacen
   verificable con goldens exactos.
4. Scope: solo tokens de color; el resto del tema no es asunto de esta tool.
