# ADR-0002: Estructura del monorepo y tooling de Zevaui

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `CONSTITUCION.md` v0.2 (RF-05 a RF-13); `ADR-0001` (D4, D6, D8) |

## Contexto

El ADR-0001 fijó el stack (PandaCSS, Style Dictionary, React Aria, Next.js, Changesets, MCP) y el modelo de consumo. Falta definir **cómo se organiza físicamente el repo `design-system`** y qué herramientas lo construyen y publican, para que:

- Cada pieza publicable sea un paquete independiente con versionado semver (RF-08, RF-10).
- El build sea reproducible y cacheado entre workspaces.
- El lint/format/a11y no dependan de configuración frágil.
- El dashboard sea el primer consumidor de los propios paquetes (dogfooding).
- La auditoría de uso sea una reusable workflow que cualquier consumidor agrega con una línea (RF-11).

## Decisión

### D1. Monorepo con workspaces: `apps/` vs `packages/`

```
design-system/
├── apps/
│   ├── dashboard/        # Next.js — registry + panel de adopción (RF-12, RF-13)
│   └── storybook/        # Storybook — documentación viva (RF-06)
├── packages/
│   ├── tokens/          # @zevaui/tokens — Style Dictionary → tokens.css + .d.ts + manifest
│   ├── components/      # @zevaui/components — React + React Aria + Panda recipes/slots
│   ├── constraints/     # @zevaui/constraints — contrato JSON + validateTheme
│   ├── mcp/             # @zevaui/mcp — servidor MCP que lee manifests
│   ├── audit/           # @zevaui/audit — reporter de la reusable workflow
│   └── config/          # @zevaui/config — presets compartidos (tsconfig, biome, panda) — NO se publica
├── .github/workflows/   # CI: lint, typecheck, test, Playwright, axe-core + audit-ds-usage.yml (reusable)
├── .changeset/          # Changesets — semver por paquete + changelog
├── docs/adrs/           # ADRs
├── biome.json
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CONSTITUCION.md
└── README.md
```

Regla de separación: **`packages/` es publicable a npm; `apps/` es ejecutable y nunca se publica.** `packages/config` es interno y se marca `private: true` en su `package.json`.

### D2. Package manager + orquestador: **pnpm + Turborepo**

- `pnpm` gestiona workspaces (symlinks, node_modules estricto, sin dependencias fantasma).
- `turbo.json` orquesta el build con caché y dependencias entre tareas (build de `components` depende de `tokens`, etc.).
- `.nvmrc`/`package.json#engines` fija la versión de Node.

### D3. Lint + format: **Biome** (una herramienta)

- `biome.json` central cubre lint y formato con cero plugins.
- La accesibilidad **no** depende de plugins de ESLint: viene garantizada por construcción (React Aria) y por el gate de **axe-core en CI** (RF-19, O2).
- Configuración compartida en `packages/config`.

### D4. Versionado: **Changesets** (semver por paquete)

- `.changeset/` con changesets por PR que tocan un paquete.
- Versionado y changelog **por paquete**, no del repo completo.
- Cada breaking change lleva su guía de migración en el changeset (O3).

### D5. Dogfooding: el dashboard consume los propios paquetes

`apps/dashboard` importa `@zevaui/components` + `@zevaui/tokens` como dependencias de workspace. Si un cambio rompe algo, lo rompe primero en casa, antes del release.

### D6. Auditoría de uso vía reusable workflow

`.github/workflows/audit-ds-usage.yml` es **reusable**. El consumidor la invoca con:

```yaml
uses: zevaui/design-system/.github/workflows/audit-ds-usage.yml@v1
```

Esa workflow corre `@zevaui/audit`, que escanea `package.json` + imports del consumidor y hace POST al registry del dashboard con `{ app, versión @ds, componentes importados, fecha }` (RF-11). Es el Mecanismo A de la constitución, opt-in.

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| Polyrepo interno (un repo por paquete) | Triplica configuración de CI/release y rompe el dogfooding (el dashboard no podría importar workspaces locales). |
| npm/yarn workspaces | pnpm elimina dependencias fantasma (crítico para publicar a yarn-PnP/bun) y es el estándar de shadcn/HeroUI. |
| nx / lerna | Turbo cubre caché + orquestación con menos configuración y es el de-facto en este segmento. |
| ESLint + Prettier | Más ecosistema de plugins, pero la a11y se garantiza por React Aria + axe-core, no por lint. Biome unifica y acelera. |
| Versionado del repo (una sola versión) | 3 paquetes independientes (RF-10) exigen semver por paquete; Changesets lo resuelve con changelog. |

## Consecuencias

**Positivas**

- Cada paquete se publica y versiona de forma independiente; los consumidores actualizan solo lo que necesitan.
- El build cacheado de Turbo acelera CI a medida que crece el sistema.
- Dogfooding detecta breaks antes del release.
- La reusable workflow convierte la auditoría de uso en una línea para el consumidor.

**Negativas / costos**

- Turborepo agrega una dependencia de orquestación y su curva.
- Biome deja fuera plugins de ESLint que pudieran ser útiles (aceptado: la a11y no depende de lint).
- Mover un paquete entre `apps/` y `packages/` exige repensar `private` y `exports`; hay que mantener la frontera limpia.

**Neutras**

- La estructura es compatible con el polyrepo de la constitución: este es un solo repo (`design-system`); `fieldsync`/`collabdocs` son repos externos que lo consumen como dependencia.

## Seguimiento (decisiones diferidas)

- Roster de los seis componentes core de la v1 (RF-05).
- Schema de `tokens.manifest.json` y `components.manifest.json` (consumidos por MCP, registry y validador).
- Políticas de release (rama `main`, pre-release, provenance) — se detallan en el flujo de CI.
- CSS por componente (cuando la v1 crezca).