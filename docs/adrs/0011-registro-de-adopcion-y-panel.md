# ADR-0011: Registro de adopción y panel: ingesta autenticada por OIDC sobre almacenamiento append-only

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-08-23 |
| Actualizada | 2026-08-25 — `D11` (runner de migraciones), `D12` (build de despliegue), `D13` (permisos del reusable workflow); se cierran los pendientes "nada corrió jamás contra una base real" y "no verificado contra Vercel" |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0009` (auditoría de uso como reusable workflow); `RF-12`, `RF-13`; `apps/dashboard`; `packages/audit`; `CONSTITUCION.md` |

## Contexto

`ADR-0009` dejó la auditoría de uso como un reusable workflow que produce un
reporte por consumidor. El reporte se sube como artifact y muere ahí: nadie
puede responder "¿qué versión del design system usa cada app?" sin abrir
repositorio por repositorio. `RF-12` (registro) y `RF-13` (panel) piden cerrar
ese hueco.

La decisión de producto la tomó el usuario sobre el trade-off completo: base de
datos y API dentro de `apps/dashboard`, lecturas públicas sin autenticación,
escrituras autenticadas directas desde el workflow del consumidor. Se rechazó
explícitamente la alternativa repo-como-registro, que `ADR-0009` había dejado
como camino de cero infraestructura.

Sobre eso se firmó **D2 de infraestructura**: Vercel Hobby más Neon free tier,
con una restricción adicional del usuario — **sin SDKs de proveedor**. Nada de
`@neondatabase/*`, nada de `@vercel/postgres`. Driver `pg` estándar, Drizzle
por encima, migraciones SQL planas. El motivo es portabilidad: cambiar de
proveedor tiene que ser un connection string y nada más.

El cambio se entregó en trece pull requests encadenados. Este ADR registra las
decisiones de diseño y — con el mismo peso — **cada divergencia entre lo que el
diseño decía y lo que se construyó**. Son diez. Varias no son errores de
implementación: son contradicciones internas del propio diseño que solo se
hicieron visibles al escribir el código.

## Decisión

### D1. La identidad la prueba GitHub, no un token compartido

La ingesta acepta únicamente tokens OIDC de GitHub Actions, verificados contra
`https://token.actions.githubusercontent.com`. No hay API keys, no hay secretos
compartidos entre el registro y los consumidores. Un consumidor que quiere
reportar no recibe nada que pueda filtrarse: pide un token efímero a su propio
runner.

El orden de las compuertas es la propiedad de seguridad, no su mera presencia:

1. `alg` fijado a `RS256` y `kid` obligatorio, **rechazados antes de cualquier
   fetch al JWKS**. Un token inservible no debe poder provocar una salida de
   red.
2. Firma verificada **antes de confiar en cualquier claim**.
3. `iss` y `aud` exactos; `exp`, `nbf` e `iat` con 60 s de tolerancia.
4. `jti` registrado **último**, solo después de autenticar. Registrarlo antes
   permitiría a un no autenticado llenar la tabla de replay a voluntad.

El guard de replay es un `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`
sobre `oidc_jti`: atómico, sin lectura previa, sin carrera.

Si el endpoint JWKS no responde, la ingesta devuelve `503 store_unavailable`.
**Falla cerrada, nunca de largo.**

Verificación RS256 con `node:crypto` (`createPublicKey({ format: "jwk" })` más
`crypto.verify("RSA-SHA256", ...)`). No se agregó librería de JWT: un módulo de
127 líneas totalmente acotado en el borde de red no justificaba una dependencia
nueva.

### D2. Almacenamiento append-only, nunca upsert destructivo

`submissions` es un log al que solo se agrega. "El último reporte por app" sale
de la vista `report_latest`, con `DISTINCT ON (repository_id, app_label)`.

El motivo es de auditoría, no de rendimiento. Bajo escrituras autenticadas
directas, **el log de escritura es la evidencia**. Sobrescribirlo borraría lo
único que permite reconstruir qué reportó quién y cuándo. Un upsert destructivo
es más barato y elimina la capacidad de investigar.

La migración no contiene ni un `UPDATE` ni un `DELETE`.

### D3. `app` es una etiqueta, jamás una identidad

`app` lo elige el consumidor y llega dentro del payload. La identidad viene de
los claims OIDC verificados, y `identity-binding.ts` es donde se cruza esa
frontera: `app` se acepta solo si coincide con el string completo
`owner/repo` del claim o con su segmento de nombre. Cualquier otra cosa es
`403 identity_mismatch`.

Encima, un allowlist de owners (`REGISTRY_ALLOWED_OWNERS`) que rechaza con
`403 owner_not_allowed` antes de mirar el binding.

### D4. Bordes numéricos explícitos, aplicados antes de parsear

`packages/audit/src/report-schema.js` es un validador puro y sin dependencias,
compartido entre el escáner y la ingesta:

| Límite | Valor |
|---|---|
| `app` | `/^[A-Za-z0-9._\-/]{1,100}$/` |
| `dsVersion` | `/^[A-Za-z0-9._\-^~+]{1,64}$/` |
| Nombre de componente | `/^[A-Za-z_$][\w$]*$/` |
| `dsVersionSource` | `installed` \| `declared` |
| Entradas por lista | 500 |
| Deriva futura de `generatedAt` | 24 h |
| Cuerpo | 64 KiB |
| Tasa | 60 por hora por `repository_id` |

La taxonomía de errores es uniforme —
`{ error: { code, message, field? } }` — y el payload nunca se devuelve.

El cap de tamaño consulta `Content-Length` **antes** de `request.text()`, y
mantiene la medición posterior como red de contención para un request que
omita o mienta el header. Un cap que primero se traga el cuerpo entero no es
una defensa contra la denegación de servicio que existe para frenar; solo la
reporta con el status correcto.

### D5. `null` y `[]` son estados distintos, y el compilador lo sostiene

`deprecatedComponents` distingue **"no sabemos"** (`null`, el consumidor nunca
reportó) de **"miramos y no hay"** (`[]`). Colapsarlos destruye la única señal
que dice si efectivamente miramos.

La regla atraviesa seis capas —columna nullable, vista `report_latest`, query,
`serializeReport`, página, componente— y desde la migración a TypeScript es un
invariante de tipo, no una convención:

```ts
readonly deprecatedComponents: readonly string[] | null;

return row.deprecatedComponents === null
  ? base                                                          // forma de 5 claves
  : { ...base, deprecatedComponents: row.deprecatedComponents };  // forma de 6 claves
```

En el panel, `null` renderiza "unknown (not reported)" y `[]` renderiza "none
reported", con atributos `data-provenance` distintos y un test que prueba que
nunca pueden coincidir.

### D6. El panel no puede mutar nada, y se demuestra

`RF-AP01` escenario 2 pide un panel de solo lectura. Se prueba de dos maneras
en vez de afirmarse en un comentario: un scan de DOM que confirma que ninguna
vista renderiza `form`, `button`, `input`, `textarea` ni `select`, y un scan de
código que busca `<form>`, `onSubmit` y llamadas fetch con `POST`/`PUT`/
`PATCH`/`DELETE` fuera del directorio de API.

Todo texto de origen externo pasa por el escapado automático de React, y una
compuerta de código prohíbe `dangerouslySetInnerHTML` en todo `apps/dashboard`.

### D7. El release log sale de los CHANGELOG, nunca de tags de git

Refinamiento de `RF-AP02`. Los tags son mutables, se pueden borrar y reescribir,
y no llevan el detalle del cambio. Los `packages/*/CHANGELOG.md` los genera
Changesets y son la fuente que ya usa el pipeline de release.

Una compuerta escanea el parser y el script de build buscando `git tag`,
`child_process` y `octokit` para que la fuente no se corra con el tiempo. No
existe conversión de markdown a HTML en ninguna parte, así que no hay
pass-through de HTML crudo que defender.

### D8. Las páginas que leen la base renderizan por request

Las tres páginas del panel declaraban `revalidate = 300`. ISR obliga a Next a
prerenderizar en tiempo de build, y el prerender ejecuta `getDb()`.

Eso hace que **el build dependa de que la base esté viva y despierta** — algo
incompatible con el autosuspend del free tier de Neon que la propia D2 de
infraestructura eligió. Las dos decisiones son razonables por separado y no
pueden sostenerse juntas.

Las dos páginas que leen la base pasaron a `dynamic = "force-dynamic"`.
`/releases` conserva ISR con revalidación de 5 minutos, porque lee el JSON
generado en build y eso sí corresponde prerenderizarlo.

### D9. Sin SDKs de proveedor, verificado en los imports

Cero referencias a `@neondatabase/*` o `@vercel/postgres`, comprobado en cada
verificación del cambio. Driver `pg` estándar, Drizzle por encima, migraciones
SQL planas. Migrar de proveedor es cambiar `DATABASE_URL`.

Como salida de emergencia adicional, `export:registry` vuelca el registro a
`reports/{owner}/{repo}/{app}.json`, que es exactamente el layout
repo-como-registro que `ADR-0009` había propuesto. El camino de vuelta queda a
un comando.

### D10. Una convención de monorepo se re-justifica por paquete

`apps/dashboard` era el único paquete en JavaScript del monorepo, con
`allowJs` y `checkJs` — anotaciones JSDoc en lugar de tipos reales — sin ningún
ADR que lo justificara. Se migró a TypeScript estricto.

Después la app heredó una segunda regla sin examinarla: importar un archivo
`.ts` hermano mediante un especificador `.js`. Esa convención es **obligatoria**
en `packages/constraints`, `packages/components` y `packages/mcp`, que emiten
ESM real vía `tsc`. `apps/dashboard` tiene `noEmit: true` y lo empaqueta Next
entero: **nunca le aplicó**.

Esa herencia sin examinar causó dos defectos separados que no parecían tener
relación:

- Turbopack, el bundler por defecto de Next 16, no resuelve ese caso
  cross-extension ni con `experimental.extensionAlias` configurado. Obligaba a
  forzar `--webpack`.
- El loader de `node --experimental-strip-types` tampoco resuelve
  especificadores sin extensión, y rompía `export:registry` de forma
  **transitiva**, dos saltos de import más adentro.

Hoy `apps/dashboard` usa imports relativos sin extensión, corre en Turbopack
por defecto (405 ms de compilación contra 24,1 s en webpack) y sus dos scripts
de CLI corren con `tsx`, que resuelve como un bundler. Una sola convención en
toda la app, y `--experimental-strip-types` ya no aparece en el repositorio.

### D11. El esquema se aplica con un runner versionado, no a mano

Las migraciones son SQL plano escrito a mano por `D2`, y el directorio
`apps/dashboard/drizzle/` no tiene `meta/_journal.json`. Sin ese journal
`drizzle-kit migrate` no puede conducirlas, así que hasta acá **no existía
ningún camino para llevar el esquema a una base**: el registro entero estaba
escrito contra un esquema que nadie podía crear salvo pegando SQL a mano.

`apps/dashboard/scripts/migrate.ts` aplica cada `.sql` pendiente en orden
lexicográfico, una transacción por migración, y registra cada una en
`schema_migrations` con su `sha256`. Volver a correrlo no aplica nada.

Se descartó pegar los dos archivos en el editor del proveedor. Es más rápido
una vez y no deja rastro de qué se aplicó ni cuándo, en el único punto del
sistema que todavía no tenía gobierno. Un proyecto cuya tesis es que la
gobernanza es el producto no puede aplicar su propio esquema sin registro.

Dos garantías que el runner sostiene, y por qué:

- **Compuerta de inmutabilidad.** Una migración ya aplicada cuyos bytes
  cambiaron, o cuyo archivo desapareció, detiene el runner antes de tocar
  nada. Es el principio 5 de la constitución (*versiones inmutables*)
  expresado como error de ejecución y no como convención: si el texto cambia,
  toda base que ya corrió el texto viejo diverge en silencio y ninguna
  migración posterior puede detectarlo.
- **Advisory lock de sesión sobre un `Client` dedicado, no un `Pool`.** El
  lock es de sesión, así que sólo serializa si todos los statements viajan por
  la misma conexión. Con un `Pool` el lock existe y no protege nada.

El orden usa un comparador de bytes explícito. `localeCompare` resuelve contra
el locale del host, de modo que el orden de aplicación no sería el mismo en
todas las máquinas, y el orden de las migraciones es un contrato de corrección.

**Evidencia contra una base Postgres real**, no sólo por forma de query:

| Verificación | Resultado |
|---|---|
| Primera corrida | aplicó `0000_init.sql` y `0001_oidc_jti.sql` |
| Segunda corrida | aplicó 0, salteó 2 (idempotencia) |
| `information_schema` | `submissions` (12 columnas), vista `report_latest`, `oidc_jti`, `schema_migrations` |
| Las cinco query builders | ejecutan contra la base real |
| Compuerta de monotonicidad | un reporte más nuevo mueve `generated_at`; uno más viejo no la mueve hacia atrás |

La verificación de queries corrió dentro de una transacción revertida: cero
filas persistidas. Esto cierra el pendiente que este mismo ADR declaraba en su
seguimiento.

El script **no carga `.env.local` por su cuenta**, deliberadamente. El gate de
`cli-scripts-entrypoint.test.ts` borra `DATABASE_URL` del entorno para probar
que el script falla por configuración y no por resolución de módulos — que es
como `export:registry` llegó roto a `main` en su momento. Si el script
repusiera la variable desde el archivo, ese gate quedaría ciego. Para uso
local, `db:migrate:local` pasa `--env-file` de forma explícita.

### D12. El build de despliegue pasa por turbo, no por la app

`apps/dashboard` **no puede construirse corriendo su propio script `build`**.
Desde un checkout limpio falla:

```
Module not found: Can't resolve '@zevaui/components/components.manifest.json'
```

`src/app/deprecated/page.tsx` importa ese manifiesto, y el manifiesto es un
**artefacto de build** de `@zevaui/components` — su mapa de exports apunta a
`dist/components.manifest.json`, que escribe el build de ese paquete. El
comportamiento por defecto de Vercel para una app Next es ejecutar el script
`build` de la app dentro del Root Directory, que es exactamente el comando que
falla.

Por eso `apps/dashboard/vercel.json` enruta ambos comandos por la raíz del
repositorio:

```json
"installCommand": "cd ../.. && pnpm install --frozen-lockfile",
"buildCommand":   "cd ../.. && pnpm turbo run build --filter=@zevaui/dashboard"
```

`turbo` resuelve `^build` y construye las dependencias del workspace antes que
la app. El `--filter` evita construir el monorepo entero en cada despliegue.
El `cd ../..` no es adorno: Vercel ejecuta los comandos desde el Root
Directory, y un `pnpm install` ahí no resuelve ningún workspace.

**Requiere una opción del panel de Vercel que este archivo no puede fijar:**
`Root Directory = apps/dashboard`. Sin eso, `outputDirectory: ".next"` apunta
al lugar equivocado.

`vercel-build-command.test.ts` fija el contrato — build por turbo, filtrado a
esta app, ambos comandos saliendo a la raíz, lockfile congelado — y además
verifica que el import del manifiesto siga existiendo, para que las compuertas
se re-justifiquen en vez de sobrevivir por inercia si ese import desaparece.

**Verificado contra Vercel real (2026-08-25).** Lo que este párrafo declaraba
pendiente ya ocurrió. Deployment `2fda01f` en Production — confirmado por SHA
vía la API de deployments, no por un `200` que podía venir del build anterior:

| Ruta | HTTP | Evidencia |
|---|---|---|
| `/api/v1/health` | 200 | `{"status":"ok"}` |
| `/` | 200 | `ZevaUI Adoption Panel`, "No reports" |
| `/releases` | 200 | `@zevaui/components` 0.2.0, 0.1.0 — `RF-AP02` en producción |
| `/api/v1/reports` | 200 | `[]`, consulta real a Neon |

El header de `/` responde `Cache-Control: private, no-cache, no-store`, que es
`D8` observable en producción.

La taxonomía de errores de `D4` también quedó verificada contra la URL real:
sin `authorization` → `token_invalid`; bearer malformado → `token_invalid`;
`content-type` incorrecto → `unsupported_media_type`.

### D13. El workflow no declara permisos, y eso es la decisión

`D1` hace que la ingesta dependa de un token OIDC que el consumidor mintea en
su propio runner. Lo que ni el diseño ni `ADR-0009` habían resuelto es **quién
pide ese permiso**, y las dos respuestas obvias están rotas. Ambas se midieron
contra un consumidor real:

| Bloque `permissions:` del reusable | Llamador | Resultado |
|---|---|---|
| `contents` + `id-token` | sin permisos | `startup_failure` a los 2 s |
| `contents` + `id-token` | concede `id-token` | success |
| sólo `contents` | sin permisos | success, submission salteada |
| sólo `contents` | concede `id-token` | success, **pero no se mintea token** |
| **ninguno** | sin permisos | success, submission salteada |
| **ninguno** | concede `id-token` | success, token minteado, POST a producción |

Un reusable workflow que pide más permisos de los que su llamador otorga es
rechazado de entrada: **no hay intersección silenciosa**. Y el bloque del
workflow llamado no es sólo un techo — decide lo que sus jobs efectivamente
reciben, así que declarar `contents: read` vuelve `RF-AR06` inalcanzable
aunque el llamador conceda identidad.

Sin bloque, los jobs heredan exactamente lo que el llamador otorgó, y los dos
consumidores funcionan. El costo es que un llamador con permisos amplios los
transfiere; se acepta porque este workflow no usa ningún scope de escritura y
ambos checkouts hacen `persist-credentials: false`.

**La lección de método pesa más que la decisión:** el segundo caso produjo una
corrida **verde** que no escribió nada. Bajo un contrato fire-and-tolerate un
run verde no prueba la submission — hay que leer el registro. Se descubrió
consultando `GET /api/v1/reports` después del run, no leyendo el log.

## Divergencias respecto del diseño y el spec, registradas

Diez reconciliaciones acumuladas entre `PR1` y las cuatro correcciones
posteriores. Se listan enteras porque varias revelan que el diseño se
contradecía a sí mismo, y ese es el hallazgo más útil del cambio.

| # | Qué decía | Qué se construyó | Por qué |
|---|---|---|---|
| 1 | `RF-AR04`, escenario con literal `deprecated: true` | Forma canónica D7 `{ since, replacement?, note? }` | El escenario del spec contradecía la forma que el propio diseño definía. Se reconcilió al firmar D2. |
| 2 | `report-schema.js` en `PR1` (tarea 1.5) | Construido en `PR3` (tarea 3.0) | Con los bordes D4 completos, `PR1` llegaba a ~660 líneas contra un presupuesto de 400. Su único consumidor es la compuerta de ingesta de `PR3`. |
| 3 | Tabla `oidc_jti` en `PR2` | Diferida a `PR3` (tarea 3.0b) | No tenía lector ni escritor hasta que existió la verificación OIDC. Una tabla que nadie toca es una tabla que nadie puede probar. |
| 4 | `GET /api/v1/reports/{owner}/{repo}` en `PR2` | Diferida a `PR4` (tarea 4.0) | El panel es su primer consumidor real. |
| 5 | `D1`: aceptar `app` si `app === claim.repository` **o** si `app` no contiene `/` | `app` debe igualar el `owner/repo` completo o su segmento de nombre | **El diseño se contradecía con el spec.** Leído al pie de la letra, el segundo caso acepta cualquier etiqueta sin barra — incluido el escenario 1 de `RF-AR02`, donde el repositorio `web` enviando `app: "mobile"` debe rechazarse. Se implementó lo estricto. |
| 6 | `RF-AR03` sin semántica de escritura explícita | Append-only más vista `report_latest` | Ver D2. Refinamiento, no contradicción. |
| 7 | `RF-AP02` sin fuente declarada para el release log | `packages/*/CHANGELOG.md`, con compuerta que prohíbe leer tags | Ver D7. |
| 8 | D4 no especificaba status ni código para content-type | `415 unsupported_media_type` | Precisión HTTP, siguiendo la convención de nombres del resto de la taxonomía. |
| 9 | "El payload nunca se devuelve" | El mensaje de `403 identity_mismatch` interpola el valor `app` recibido | **Juzgado aceptable, no defecto.** Para ese punto `app` ya pasó el filtro estricto de charset de D4, y el test real de no-eco apunta al camino `schema_invalid`, que está limpio. Se registra porque la lectura literal de la regla lo prohibiría. |
| 10 | `D5`: `revalidate = 300` en las tres páginas | `force-dynamic` en las dos que leen la base | **`D5` contradice la D2 de infraestructura.** Ver D8. |

Divergencias de entrega, sin efecto sobre el producto: el corte sugerido de
`PR3` en dos rebanadas medía 461 líneas en la primera y se partió en cinco; el
de `PR4` en tres medía 484 y se partió en cuatro. El presupuesto de 400 líneas
por PR se sostuvo en las trece.

## Alternativas consideradas

**Repo-como-registro, sin infraestructura.** Es lo que `ADR-0009` había
propuesto y lo que el usuario rechazó explícitamente, con el trade-off completo
a la vista. Sobrevive igual como salida de emergencia (`export:registry`, D9),
que es lo que la hace descartable sin costo de encierro.

**Un token compartido en vez de OIDC.** Más simple de implementar y de
explicar. Descartada porque exige distribuir un secreto a cada repositorio
consumidor, y un secreto distribuido es un secreto filtrado eventualmente.
OIDC no requiere entregar nada.

**Upsert destructivo sobre una fila por app.** Menos filas, consultas más
simples, sin necesidad de vista. Descartada por D2: destruye la evidencia.

**Una librería de JWT.** Descartada: `node:crypto` cubre RS256 completo y el
módulo está totalmente acotado y probado. Una dependencia nueva en el borde de
red se paga en superficie de ataque.

**Mantener `--webpack` y no tocar la convención de imports.** Habría cerrado el
build sin más cambios. Descartada porque clavaba la app a un bundler en camino
a deprecarse para preservar un estilo de import que a esta app nunca le aplicó.

## Consecuencias

**Positivas**

- Ningún consumidor recibe un secreto para poder reportar.
- El registro es auditable por construcción: el log de escritura es la
  evidencia y no se sobrescribe.
- La distinción `null` contra `[]` dejó de depender de que nadie escriba
  `?? []` por distracción; hoy es un error de compilación.
- La portabilidad de D2 es verificable, no declarativa: cero SDKs de proveedor
  en los imports, y el volcado a archivos a un comando.
- `apps/dashboard` compila en 405 ms y quedó consistente con el resto del
  monorepo en lenguaje y en tooling.

**Negativas**

- Las dos páginas que leen la base ya no se cachean con ISR. Con el autosuspend
  de Neon, un primer request tras la suspensión paga el cold start completo.
  Es el precio directo de D8.
- El registro es infraestructura que hay que operar. `ADR-0009` no la tenía.
- `tsx` es una dependencia de desarrollo nueva, aunque ya estaba resuelta
  transitivamente y solo se promovió a pin explícito.

**Neutras**

- El repositorio quedó con dos convenciones de import deliberadamente
  distintas: con extensión `.js` en los paquetes que emiten ESM, sin extensión
  en `apps/dashboard`. La diferencia es correcta y está justificada en D10;
  documentarla es lo que evita que alguien "unifique" y rompa una de las dos.

## Seguimiento (decisiones diferidas)

- **`?? []` sigue siendo posible.** `readonly string[] | null` exige que el
  campo esté presente, pero `string[]` es un miembro válido de la unión, así
  que el tipo no prohíbe estructuralmente un colapso futuro. Un tipo envuelto
  (`{ kind: "unknown" } | { kind: "known", value: readonly string[] }`) lo
  cerraría del todo, a costa de ruido en todos los consumidores.
- **La compuerta de `dangerouslySetInnerHTML` es un grep literal**, no una regla
  AST. Protege contra el riesgo real de autoría, pero se evade con una clave
  computada. Una regla de lint propia lo endurecería.
- **El scan de no-mutación enumera tres componentes conocidos.** Una vista nueva
  agregada sin extender el test lo evade. El disparador para pasar a
  descubrimiento por glob es la cuarta vista.
- **El smoke test de los scripts CLI es ciego a imports muertos**: la transformación
  de esbuild elimina los bindings no referenciados antes de que Node intente
  resolverlos. Cubre roturas en caminos de código vivos, que es la clase real de
  regresión.
- **`as unknown as Request`** en `reports-post-route.test.ts` es evitable: la
  implementación `undici` de Node no aplica las restricciones de headers
  prohibidos del spec Fetch, así que un `Request` real puede llevar un
  `content-length` deliberadamente inconsistente.
- ~~**Sin poda de `oidc_jti`.**~~ **Cerrado el 2026-08-26.** La poda ahora tiene
  dueño: el propio camino de ingesta. Cada envío autenticado borra las filas con
  `expires_at` anterior a `ahora − skew` (60 s, el mismo margen que tolera el
  verificador) antes de registrar su `jti`, así el tamaño estable de la tabla
  queda acotado por una ventana de tráfico sin cron externo. Query
  `pruneExpiredJtiQuery` con su test de forma SQL en `queries.test.ts`.
- ~~**Nada corrió jamás contra una base real.**~~ **Cerrado el 2026-08-25.**
  Ver `D11`: el esquema se aplicó a una base Postgres real y las cinco query
  builders se ejecutaron contra ella. Lo que sigue abierto no es la capa de
  datos sino el alojamiento: `M.1` (proyecto en Vercel), `M.3` (variables de
  entorno en Vercel) y `M.4` (revalidación del probe).
- **`M.4` sigue sin correr, y congela el tag `v1`.** El contrato de `D6` dice
  que un consumidor que nunca setea `registry-url` se comporta byte a byte
  como antes. Está probado por construcción y a nivel de script, pero no por
  una corrida real del workflow en `zevaui-consumer-probe`. Hasta que esa
  corrida exista, `v1` no avanza.
