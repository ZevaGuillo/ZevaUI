# ADR-0001: Stack tecnológico y modelo de consumo de Zevaui

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `CONSTITUTION.md` v0.2 — principios 1, 3, 4, 5, 6 |

## Contexto

Zevaui es un sistema de diseño con gobernanza para múltiples aplicaciones consumidoras. Antes de implementar, es necesario fijar decisiones de stack que condicionan todo lo demás:

1. Qué motor de estilos usa internamente el sistema.
2. Dónde vive la fuente de verdad de los tokens.
3. Qué capa provee comportamiento accesible (ARIA, teclado, foco).
4. Qué framework sostiene la aplicación del registro y el panel de adopción.
5. Cómo consumen los proyectos el sistema, y con qué herramientas convive.
6. Cómo se publica y versiona.
7. Nombrado de paquetes.

Restricciones que impone la constitución: los paquetes son build-time y tenant-agnostic (sección 4); los componentes consumen solo CSS vars y exponen slots (RF-07); la accesibilidad es requisito funcional (principio 3); una sola fuente de verdad (principio 4); versionado semver con guía de migración (principio 5, O3).

## Decisión

### D1. Motor de estilos: PandaCSS (build-time, interno)

PandaCSS es el motor de estilos de `@zevaui/components`. Su modelo `tokens` + `semanticTokens`, `recipes` y `slots` mapea 1:1 con el modelo de gobernanza: tokens crudos vs semánticos, variantes tipadas y puntos de composición.

La decisión es **interna**: el consumidor nunca instala ni usa Panda. Recibe CSS compilado, JS compilado y tipos.

### D2. Fuente de verdad de tokens: Style Dictionary (DTCG)

Style Dictionary mantiene la fuente única de tokens en formato DTCG (Design Tokens Community Group). Genera, en tiempo de build:

- `tokens.css` — custom properties `--zui-*` y selectores de tema (claro, oscuro, alto contraste).
- `tokens.d.ts` — tipos TypeScript.
- `tokens.manifest.json` — consumido por el validador y por el MCP.

Panda no es dueño de los tokens: solo los referencia. Así se preserva la salida DTCG limpia y el manifest que necesitan el resto de piezas.

### D3. Comportamiento accesible: React Aria (`react-aria-components`)

React Aria (Adobe) aporta el comportamiento accesible (WAI-ARIA, navegación por teclado, gestión de foco, i18n) de forma headless. Se usa `react-aria-components` (RAC), construido sobre los hooks. La capa visual la aporta Panda.

- Es **dependencia interna** de `@zevaui/components`; el consumidor no interactúa con ella.
- Se re-exportan prop types propios para no filtrar tipos de RAC.
- Los componentes interactivos (RAC) son client-side (`'use client'`); los presentacionales puros (`Text`, `Box`, layout) quedan server-renderables.

### D4. Framework de la aplicación: Next.js

El registry + panel de adopción corren sobre Next.js. La app es un backend fino: SSR/SSG por defecto, islas client solo donde hay interactividad.

Storybook es la documentación viva de componentes y es **separado** de esta app.

### D5. Modelo de consumo

El consumidor recibe dos capas de CSS separadas:

- `@zevaui/tokens/styles.css` — solo variables `--zui-*` + temas.
- `@zevaui/components/styles.css` — estilos scoped `.zui-*` que referencian esas variables.

Reglas:

- Un import por archivo en el root de la app. Sin runtime, sin inyección JS.
- **No se publica un CSS reset global** (no debe romper el layout del consumidor).
- En la v1, un único `styles.css`; el CSS por componente se evalúa a escala.
- El consumidor **tema sobrescribiendo CSS variables** (first-class), nunca forkeando componentes (RF-10).
- Convive con cualquier tool de estilos vía puente: en Tailwind v4 se mapea con `@theme inline`; en Panda, con alias de tokens a `var(--zui-*)`.

### D6. Publicación: npm público, un artefacto, Changesets + provenance

- Un único artefacto por paquete publicado a npm público (`@zevaui/*`).
- npm, yarn, pnpm y bun leen el mismo registro: no existe publicación por manager.
- Versionado con Changesets (semver por paquete + changelog + guía de migración).
- Publicación desde CI con provenance (firma de build).
- `sideEffects: ["**/*.css"]` para que el CSS no se elimine por tree-shaking.
- `react` / `react-dom` como `peerDependencies`.

### D7. Nombrado

Zevaui. Paquetes `@zevaui/tokens`, `@zevaui/components`, `@zevaui/constraints`. Prefijo CSS `--zui-*`, clases `.zui-*`.

### D8. MCP de componentes y tokens

Un servidor MCP (SDK oficial de TypeScript) expone componentes y tokens a agentes. Lee los manifests generados en build (`tokens.manifest.json` + `components.manifest.json`), nunca escanea código fuente. Herramientas: `list_components`, `get_component`, `search_tokens`, `get_token`, `list_themes`, `validate_theme` (reusa el validador de `@zevaui/constraints`).

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| Tailwind CSS v4 para componentes | Utility-first empuja a clases literales en los consumidores (contra RF-04/RF-07); no tiene recipes/slots tipados equivalentes. |
| CSS vanilla (sin motor) | Máxima portabilidad, pero obliga a reimplementar recipes/slots/tipos a mano. |
| styled-components / emotion (runtime) | CSS-in-JS en runtime: costo en SSR, FOUC y Core Web Vitals (RNF-02). |
| TanStack Start para la app | `createServerFn` y type-safety end-to-end atractivas, pero ecosistema más joven y menos defaults de deploy; la madurez pesa para una app de gobernanza. |
| Hooks crudos de React Aria (`useButton`) | Mayor control, pero más verboso; RAC da una API consistente de nivel alto. |
| Registro privado (GitHub Packages / Verdaccio) | Agrega auth por consumidor; el objetivo es consumo público. |

## Consecuencias

**Positivas**

- Gobernanza nativa: tokens + semanticTokens, regresión visual reproducible, accesibilidad por diseño.
- Consumidores agnósticos del motor de estilos; tematización por variables sin forkear.
- Un solo artefacto público consumible por los cuatro managers.
- El MCP y el validador comparten la misma fuente (manifests), cero lógica duplicada.

**Negativas / costos**

- PandaCSS es una dependencia de build con su propia curva; obliga a un paso de codegen en CI.
- Un único `styles.css` en v1 implica cargar el CSS de todos los componentes; se resuelve a escala con CSS por componente.
- Next.js trae más superficie que la necesaria para un backend fino; se acepta por madurez.

**Neutras**

- El framework de la app no condiciona los paquetes publicados (que son React plano).

## Seguimiento (decisiones diferidas)

- Estructura de workspaces del monorepo (siguiente ADR o documento de diseño).
- Roster de los seis componentes core (RF-05).
- Schema de `components.manifest.json` (metadata del MCP y del registry).
- CSS por componente (cuando la v1 crezca).
