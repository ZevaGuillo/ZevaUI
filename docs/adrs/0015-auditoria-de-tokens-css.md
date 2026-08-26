# ADR-0015: Auditoría de tokens CSS: cerrar el punto ciego del escáner

| Campo | Valor |
|---|---|
| Estado | **Propuesta** — analizada contra el código real, no programada |
| Fecha | 2026-08-26 |
| Autor | Guillermo Zevallos |
| Decisores | Pendiente — se decidirá al programar la implementación |
| Relacionado | `ADR-0009` (escáner y reusable workflow); `ADR-0011` (registro, D5, RF-AR05/AR07); `packages/tokens` (Style Dictionary, `tokens.manifest.json`); `packages/audit` |

> Este ADR registra una propuesta de evolución con su análisis de viabilidad.
> Nada de lo descrito está construido.

## Contexto: qué problema busca resolver

El escáner rastrea únicamente `import` desde `@zevaui/components` y
`@zevaui/tokens`. Pero los tokens se emiten como CSS custom properties, y el
README del propio design system documenta que el consumidor puede usarlas
directamente: `color: var(--zui-color-accent-strong)` en su CSS. Si el design
system renombra o elimina ese token, **la auditoría no lo ve**. Renombrar un
token es probablemente el vector de ruptura más frecuente en un design system
real, y es exactamente el que hoy se escapa.

La propuesta: escanear los `.css`/`.tsx` del consumidor buscando
`var(--zui-*)` y cruzar contra el manifest de tokens.

## Hallazgo que abarata todo: el manifest de tokens ya existe

La propuesta original asumía que había que crear un "manifest de tokens". Es
falso: `packages/tokens/scripts/build.js` (Style Dictionary v4, prefijo
`zui`) ya emite `dist/tokens.manifest.json` como **export público del
paquete** (`"./tokens.manifest.json"`), con 44 tokens y campo `cssVar` por
token (`"--zui-radius-input"`), `isSemantic` y valores por tema. No hay
artefacto nuevo que construir; solo el cruce.

## La paradoja del blanking

El lexer actual (`blankSource`) **borra** strings, template literals y
comments antes de buscar imports — y `var(--zui-*)` en un `.tsx` vive
justamente dentro de strings y template literals. El problema se invierte
respecto de los imports: para tokens, **los strings son la señal**, no el
ruido; el único falso positivo real son los comments.

Dos rutas evaluadas:

- **Simple**: regex `var\(\s*(--zui-[A-Za-z0-9-]+)` sobre el fuente crudo,
  aceptando falsos positivos en código comentado — alineado con la filosofía
  documentada del escáner ("guess toward the loud error": FP ruidoso antes
  que FN silencioso).
- **Sólida**: extender `blankSource` para clasificar spans (comment vs
  string) — preserva offsets by design, así que es factible — y buscar solo
  dentro de spans string.

Para `.css` no existe lexer: hoy `walk-source-tree.js` ni siquiera abre esos
archivos (`ALLOWED_EXTENSIONS` es solo JS/TS). Hace falta una segunda
allowlist de extensiones y un `scan-css.js` propio (blanking de `/* */`
trivial + la misma regex). `walkAndScan` pasa a despachar scanner por
extensión y devolver una segunda colección (`tokenRefs`).

## Decisión propuesta

### P1. El cruce es local y sin red

El cruce lee `node_modules/@zevaui/tokens/dist/tokens.manifest.json` del
consumidor, espejando el patrón tri-estado de `resolveDeprecated`:
manifest ausente o corrupto ⇒ `null` = "no sabemos" (D5), nunca un error.
Cero red — `RF-AR07` intacto. Riesgo conocido: con pnpm estricto, si
`@zevaui/tokens` es solo dependencia transitiva de `components`, puede no
estar hoisted — documentar y testear el fallback vía
`node_modules/@zevaui/components/node_modules/`.

**Los "unknown tokens" — usados por el consumidor pero ausentes del manifest —
son el valor real del cruce**: eso es la detección de renames.

### P2. Campo `tokens` aditivo, con la plantilla de `deprecatedComponents`

Campo opcional omit-when-absent en el reporte (RF-AR05), con tri-estado
NULL/vacío/valores (D5). Validación nueva: `COMPONENT_NAME_PATTERN` no admite
guiones, así que hace falta un `TOKEN_PATTERN` propio
(`/^--zui-[a-z0-9-]{1,64}$/`). `MAX_LIST_ENTRIES=500` sobra (44 tokens hoy).

**Orden de despliegue obligatorio: esquema+registro primero, emisión
después.** `ALLOWED_KEYS` es cerrado: un registro viejo rechaza el campo con
400, y `submit-report.js` always-exit-0 convierte esa pérdida en un warning
que nadie mira. El despliegue mal ordenado no rompe el CI de nadie — pierde
datos en silencio, que es peor.

### P3. Base y panel

Migración 0002 con el runner de D11: `ALTER TABLE submissions ADD COLUMN
tokens text[]` nullable + `CREATE OR REPLACE VIEW report_latest` (append de
columna al final; el bloque `reportColumns` de drizzle es compartido
tabla/vista, un solo cambio tipado). `NULL` = unknown, vacío = miró-y-no-hay
(D3/D5). Las queries hacen `select()` de la vista, así que la columna fluye
sola; UI incremental. `export:registry` gana la clave aditiva sin cambios.

Decisión pendiente de resolver al implementar: `ingest-report.ts` calcula
`schemaVersion` por presencia de `deprecatedComponents` (1 ó 2); un tercer
campo vuelve la regla combinatoria — propuesta: `3` = shape con tokens.

## Plan de implementación (4 PRs ≤400 líneas, ~2–4 días)

| PR | Contenido | Estimado |
|---|---|---|
| 1 | `report-schema` con `tokens` opcional + migración 0002 + ingesta + `schemaVersion` | 200–300 |
| 2 | Scanner de token-refs (+ `scan-css.js`) + integración con el walker + tests | 250–350 |
| 3 | Wiring `audit-usage`/`build-report` + cruce con manifest + fixtures del gate | 200–300 |
| 4 | Panel + smoke de export | 100–200 |

## Alternativas consideradas

**Reutilizar el texto blanqueado tal cual.** Descartada: borra la señal.

**Crear un manifest de tokens nuevo.** Innecesaria: ya existe como export
público con `cssVar` por token.

**Resolver el manifest por red.** Descartada: `RF-AR07` exige el paso de scan
sin red; la lectura es local a `node_modules`.

## Riesgos

1. **Mayor**: orden de despliegue registro-antes-que-emisión, con pérdida
   silenciosa enmascarada por always-exit-0.
2. Resolución del manifest bajo pnpm estricto (no hoisted).
3. Fixtures byte-exactos del gate (`assert-usage-report.js` compara
   deep-equal): actualizar ambas formas + tercer escenario con manifest de
   tokens plantado.
4. Tokens dinámicos (`var(--zui-${x}-500)`) son falsos negativos aceptados y
   documentados — misma postura que el import scanner.
5. Volumen extra de `.css` contra el cap de 20 000 archivos (menor).

## Sinergias

La pasada CSS (walker parametrizado + `scan-css.js`) es **slice compartido
con `ADR-0016`** (conformance): la primera de las dos propuestas que se
implemente lo construye, la otra lo consume. El mismo
`tokens.manifest.json` alimenta el MCP (`ADR-0003`) y esta auditoría —
una sola fuente de verdad (Principio 4).
