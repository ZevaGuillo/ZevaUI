# Constitución del Proyecto — `design-system`

> Este documento es la fuente canónica. Existe una traducción al inglés en
> [CONSTITUTION.md](./CONSTITUTION.md); si alguna vez divergen, gobierna este
> texto en español.

| Campo | Valor |
|---|---|
| Nombre | `design-system` |
| Tipo | Sistema de diseño con gobernanza (DesignOps) |
| Estado | Definición inicial |
| Versión | 0.2 |
| Fecha | 2026-08-16 |
| Autor | Guillermo Zevallos |

---

## 1. Nombre y propósito en una línea

Un sistema de diseño con gobernanza que garantiza que ningún cambio rompa a quien ya lo consume.

---

## 2. La razón real (por qué existe este proyecto)

Este proyecto existe porque un problema real está mal resuelto en la práctica: cuando varias aplicaciones comparten un sistema de diseño, casi siempre termina mal. Un cambio de token rompe productos en producción sin aviso. Nadie sabe qué versión consume cada aplicación. La accesibilidad se degrada release tras release. La causa rara vez es la falta de componentes: es la falta de gobierno.

El problema central que lo motiva (del catálogo de proyectos):

> *"Un sistema de diseño no falla por falta de componentes sino por falta de gobierno: nadie sabe qué versión usa cada aplicación, un cambio de token rompe tres productos sin aviso, y la accesibilidad se degrada sin que nadie lo note. El problema no es construir botones, es garantizar que el cambio no rompa a quien ya lo consume."*

**Tesis del proyecto:** los componentes son la excusa; la gobernanza es el producto.

---

## 3. Principios (no negociables)

Estos son los artículos de la constitución. No se negocian por presión de tiempo ni de alcance.

1. **La gobernanza es el producto.** No se agrega un componente si no viene acompañado de la garantía de que el cambio no rompe a los consumidores (versionado, contract testing, regresión visual).
2. **Evidencia sobre opinión.** Toda afirmación de calidad se sostiene con una métrica medible. Sin número, no está terminado.
3. **La accesibilidad es requisito funcional, no auditoría.** Un cambio que degrada la accesibilidad no se integra.
4. **Una sola fuente de verdad.** Los tokens viven en un único lugar; todo lo demás (CSS, TypeScript, temas) deriva de esa fuente. Nada se codifica de forma literal en los consumidores.
5. **Versiones inmutables.** Un release publicado no se reescribe. Cada cambio que rompe compatibilidad incluye una guía de migración.
6. **Toda decisión no trivial deja un ADR**, con las alternativas descartadas y su justificación.
7. **Documentación viva.** El README permite entender el problema sin leer el código.

---

## 4. Límites (qué NO es este proyecto)

- No es un producto con usuarios finales; es infraestructura para las aplicaciones que lo consumen.
- No es una librería de componentes "bonita": un componente sin gobernanza no pertenece a este proyecto.
- No es fullstack: la capa de backend es fina (registro de versiones y panel de adopción). El fullstack duro vive en los productos que lo consumen.
- Su prioridad es resolver el problema de gobernanza, no alcanzar una cobertura amplia de componentes.
- **No conoce a los tenants.** El design system es un artefacto build-time y tenant-agnostic. La administración multi-tenant (creación de tenants, editor de temas, almacenamiento de `tenant → tema`) es responsabilidad de la aplicación consumidora, no del design system. El design system publica el contrato de reglas y un validador; la aplicación los aplica en runtime.

---

## 5. Objetivos medibles

| # | Objetivo | Cómo se verifica |
|---|---|---|
| O1 | Un cambio de token se detecta automáticamente si rompe a un consumidor | Contract testing previo al release |
| O2 | Cero violaciones críticas de accesibilidad en CI | Gate de axe-core bloqueante |
| O3 | Cero cambios que rompen compatibilidad publicados sin guía de migración | Changelog + guías de migración |
| O4 | Responder en menos de un minuto qué versión consume cada aplicación | Registro de versiones + panel de adopción |
| O5 | Regresión visual no frágil: un cambio real se detecta, uno irrelevante no bloquea | Thresholds explícitos en CI |
| O6 | Un tema de tenant que rompe contraste se rechaza antes de guardarse | Validador del design system aplicado en el theme editor de la app |

---

## 6. Alcance

### 6.1 Paquetes publicados (todos build-time, tenant-agnostic)

El design system se publica como paquetes independientes:

| Paquete | Contenido | Tiempo |
|---|---|---|
| `@<usuario>/tokens` | Fuente de verdad de tokens; genera CSS custom properties y tipos TypeScript | build |
| `@<usuario>/components` | Componentes core que consumen solo CSS vars (nunca valores literales) y exponen slots para composición | build |
| `@<usuario>/constraints` | Contrato de reglas machine-readable (qué token es color, qué pares deben pasar contraste WCAG AA, escalas válidas) y un validador (`validateTheme(theme) → Pass/Fail`) | build |

### 6.2 En la v1

- Tokens: colores, tipografía, espaciado, radios, sombras; tres temas base (claro, oscuro, alto contraste).
- Conjunto mínimo de componentes core (seis, a definir).
- Tematización: los tokens se emiten como **CSS custom properties** (`var(--color-primary)`), lo que habilita theming en runtime por parte de los consumidores sin que el design system conozca a los tenants.
- Documentación viva (Storybook) con ejemplos ejecutables.
- CI bloqueante: lint, typecheck, test, regresión visual, accesibilidad, validación de temas base contra el contrato.
- Versionado semántico del paquete y guías de migración.
- **Registry de versiones + panel de adopción** (backend fino): audita qué versión consume cada aplicación y qué versión se publicó.
- **Contract testing** entre el sistema y sus consumidores (detecta cambios que rompen compatibilidad antes del release).
- **Contrato de reglas + validador** (`@<usuario>/constraints`): el CI del design system valida los temas base; la aplicación consumidora aplica el validador en su theme editor para rechazar temas de tenant que rompen las reglas.

### 6.3 Fuera de la v1 (crece después)

- Sincronización con herramienta de diseño (Figma / Tokens Studio).
- Multi-framework.
- Escaneo centralizado (central manifest / code search vía GitHub API) para detectar consumidores que no reportan — necesario solo a escala, cuando hay muchos consumidores en una organización.
- Cobertura amplia de componentes.

### 6.4 Mecanismo de auditoría de uso (punto 2 de la conversación)

El registry sabe qué aplicaciones consumen el design system mediante dos mecanismos:

**Mecanismo A (por defecto) — el consumer reporta, opt-in.**

El design system publica una reusable workflow (`audit-ds-usage.yml`). La aplicación consumidora la agrega a su CI con una línea. Esa workflow:

1. Lee el `package.json` del consumer y obtiene la versión instalada de `@<usuario>/components`.
2. Parsea los `import` desde `@<usuario>/components` / `@<usuario>/tokens`.
3. Hace `POST` de un reporte al registry con: `{ app, versión @ds, componentes importados, componentes deprecados usados, fecha }`.

Consideración honesta: el reporte es **opt-in** (depende de que el consumer agregue la workflow). Para un portfolio con pocas aplicaciones controladas por el mismo autor, esto basta y es suficiente.

**Mecanismo B (opcional, para escala) — escaneo centralizado.**

Cuando hay muchos consumidores en una organización y un consumidor puede no reportar, el registry necesita una fuente de señal independiente. Tres opciones:

| Opción | Cómo | Lo que detecta |
|---|---|---|
| CI manifest scan central | Una workflow en el repo del design system recorre los `package.json` de los repos de la org vía GitHub API | Quién declara `@<usuario>/...` como dependencia |
| Code search | Búsqueda de `import.*@<usuario>/` en código de la org (GitHub API / Sourcegraph) | Quién importa el design system en su código |
| Tag del consumidor | Cada repo consumidor se etiqueta con el topic `ds:consumer` y una workflow central lo lee | Quién se declara consumidor |

El mecanismo B **se introduce a escala**. No es necesario para la v1 con pocas aplicaciones; **documentar que existe cierra el agujero del opt-in cuando el contexto lo exige**.

---

## 7. Definición de "terminado"

Un cambio está terminado cuando cumple las tres condiciones:

1. La documentación permite entender el problema sin leer el código.
2. Los ADRs explican las alternativas descartadas.
3. Existe al menos una métrica medida que respalda la decisión principal.

Sin estas tres condiciones, el trabajo no está terminado: está abandonado con buena presentación.

---

## 8. Requisitos del software

### 8.1 Paquetes y arquitectura

El design system se publica como tres paquetes independientes, todos build-time y tenant-agnostic:

- **`@<usuario>/tokens`** — fuente de verdad de tokens; genera CSS custom properties y tipos TypeScript.
- **`@<usuario>/components`** — componentes core que consumen únicamente CSS vars y exponen slots para composición.
- **`@<usuario>/constraints`** — contrato de reglas machine-readable + validador.

### 8.2 Requisitos funcionales (RF)

**Tokens**

- **RF-01** — El sistema mantiene una única fuente de verdad de tokens.
- **RF-02** — Genera, en tiempo de build, CSS custom properties y tipos TypeScript a partir de esa fuente.
- **RF-03** — Provee tres temas base: claro, oscuro y alto contraste, validados contra el contrato.
- **RF-04** — Impide valores de estilo codificados de forma literal en los consumidores (verificado por lint/grep en CI).

**Componentes**

- **RF-05** — La v1 incluye un conjunto mínimo de seis componentes core, todos derivados de tokens.
- **RF-06** — Cada componente expone documentación ejecutable (Storybook) con sus variantes.
- **RF-07** — Cada componente consume únicamente CSS vars y expone slots para composición (sin variación estructural por consumer; variación visual solo por tokens).

**Versionado y publicación**

- **RF-08** — Publicación con versionado semántico y changelog generado.
- **RF-09** — Todo cambio que rompe compatibilidad incluye una guía de migración.
- **RF-10** — Las versiones por aplicación se logran mediante versionado del paquete (semver). No se crean componentes derivados por aplicación (anti-pattern explícito).

**Gobernanza — auditoría de uso (backend fino)**

- **RF-11** — El design system publica una reusable workflow de auditoría que el consumer agrega a su CI para reportar su uso (versión instalada + componentes importados).
- **RF-12** — Un registro (registry) almacena los reportes de los consumidores: `{ app, versión @ds, componentes importados, componentes deprecados, fecha }`.
- **RF-13** — Un panel de adopción de solo lectura muestra las versiones por aplicación, los componentes obsoletos en uso y el release log de publicaciones.

**Gobernanza — control de reglas (contrato + validador)**

- **RF-14** — El design system publica un contrato de reglas machine-readable (tipos de token, pares de contraste WCAG AA, escalas válidas).
- **RF-15** — El design system publica un validador `validateTheme(theme) → Pass/Fail` con la lista de violaciones.
- **RF-16** — El CI del design system valida los temas base contra el contrato (gate bloqueante).
- **RF-17** — El validador se publica como dependencia para que el theme editor de las aplicaciones rechace temas de tenant que rompen las reglas antes de guardarlos. El design system no conoce a los tenants.

**Calidad**

- **RF-18** — Pruebas de regresión visual automatizadas en CI.
- **RF-19** — Verificación de accesibilidad en CI, de carácter bloqueante.
- **RF-20** — Contract testing entre el design system y sus consumidores.

### 8.3 Requisitos no funcionales (RNF)

- **RNF-01 (Accesibilidad)** — Cumplir WCAG 2.2 AA; cero violaciones críticas en CI. Para temas de tenant, el validador rechaza combinaciones que rompen contraste.
- **RNF-02 (Rendimiento)** — Presupuesto de bundle declarado y vigilado; la integración del sistema no degrada los Core Web Vitals de los consumidores.
- **RNF-03 (Determinismo)** — La regresión visual es reproducible (no frágil), con umbrales explícitos.
- **RNF-04 (Mantenibilidad)** — Toda decisión no trivial queda registrada en un ADR.
- **RNF-05 (Medición)** — Cada cambio relevante registra una métrica antes/después en el historial.
- **RNF-06 (Seguridad)** — El panel de adopción es de solo lectura para visitantes; las mutaciones requieren autenticación.
- **RNF-07 (Portabilidad)** — Los consumidores instalan el sistema como dependencia versionada, sin pasos manuales.
- **RNF-08 (Desacoplamiento)** — Ningún paquete del design system referencia a tenants, aplicaciones concretas ni a su runtime. La administración multi-tenant es externa.

---

## 9. Stack técnico

| Capa | Tecnología |
|---|---|
| Tokens | Style Dictionary |
| Componentes | React + TypeScript |
| Documentación | Storybook |
| Contrato de reglas | JSON machine-readable + validador TypeScript |
| CI | GitHub Actions (lint, typecheck, test, Playwright, axe-core, Lighthouse) |
| Registry y panel | Node + Postgres (o SQLite para la v1), API mínima |
| Publicación | npm, con semver |

---

## 10. Estructura y repositorios (polyrepo)

| Repositorio | Rol |
|---|---|
| `design-system` (este) | Paquetes `tokens`, `components`, `constraints`, CI, registry + panel de adopción |
| `fieldsync`, `collabdocs`, etc. | Repos independientes que consumen los paquetes como dependencias versionadas |

### Dónde vive cada cosa

| Responsabilidad | ¿Dónde? | ¿Conoce tenants? |
|---|---|---|
| Tokens y componentes (build-time) | `@<usuario>/tokens`, `@<usuario>/components` | No |
| Contrato de reglas + validador (build-time) | `@<usuario>/constraints` | No |
| Registry + panel de adopción (backend fino) | repo `design-system` | No |
| Escaneo centralizado (a escala) | repo `design-system`, workflow central | No |
| Administración multi-tenant: creación de tenants, theme editor, almacenamiento `tenant → tema` | **repositorio de cada aplicación consumidora** | **Sí** |

---

## 11. Referencia

- Catálogo de Proyectos Full Stack — Volumen II (proyecto 06 · DesignOps).
