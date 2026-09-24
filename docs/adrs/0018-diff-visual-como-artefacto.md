# ADR-0018: El diff visual como artefacto en el PR, no solo como semáforo

| Campo | Valor |
|---|---|
| Estado | Aceptada — **V0 implementada**; V1 y V2 diferidas |
| Fecha | 2026-08-26 (V0 implementada el 2026-09-24) |
| Autor | Guillermo Zevallos |
| Decisores | Guillermo Zevallos |
| Relacionado | `ADR-0008` (regresión visual, baselines Linux); `apps/storybook`; `.github/workflows/{ci,visual-baselines}.yml`; precedente de escape `cell()` en `packages/audit` |

> **V0 (P1) está construida**: `ci.yml` sube el diff como artifact y lo resume
> en el step summary. **V1 (P2) y V2 (P4) siguen sin construir** — el análisis
> de viabilidad de abajo se conserva tal como se escribió.
>
> Lo que disparó programar V0: el flake de `DateField.stories.tsx > Focused
> Segment` pega ~1 de cada 3 corridas (evidencia: tres corridas del mismo
> commit `7a9863d` con resultados distintos) y su hipótesis — la modalidad de
> interacción de react-aria es estado GLOBAL del documento, y el `outline` de
> `[data-focus-visible]` en `textSurfaceBase` da del orden de los 260 px que
> reporta el fallo — **no se podía confirmar ni refutar sin la imagen**. Ese es
> el valor de V0 medido en un caso real: sin el diff, cualquier arreglo del
> flake es una adivinanza.

## Contexto: qué problema busca resolver

La regresión visual hoy es rojo o verde. Cuando el gate falla, el PNG del
diff — la evidencia de **qué** cambió — muere en el runner: `@vitest/browser`
escribe actual+diff en `.vitest-attachments/` (ruta verificada:
`apps/storybook/.vitest-attachments/stories/<Story>.stories.tsx/<Test>-1-diff-chromium-linux.png`),
y ese directorio está gitignored ("Debris written by failing visual runs").
Quien revisa el PR ve un check rojo y tiene que reproducir localmente para
ver el diff. Chromatic cobra por resolver exactamente esto.

## El hallazgo central: la imagen inline no es gratis

La propuesta original ("subir el PNG y postearlo en un comentario") suena
trivial y no lo es. Las cuatro vías, medidas:

| Vía | Resultado |
|---|---|
| A. Artifact + link | Los artifacts **no tienen URL de imagen embebible** — la descarga es un zip autenticado. Solo se puede enlazar al run. Costo casi cero, sin imagen inline. |
| B. Commitear los diffs a rama huérfana | Única vía "gratis" real a imagen inline (`raw.githubusercontent.com`). Exige `contents: write` + limpieza de basura por PR; contradice el least-privilege medido del repo. Es un mini-proyecto. |
| C. Checks API con `output.images[]` | `image_url` exige una URL **ya alojada** — no resuelve el hosting, solo el render. Depende de B o de hosting externo. Descartable. |
| D. `GITHUB_STEP_SUMMARY` | Renderiza GFM pero el sanitizador (camo) elimina los `data:` URI y los paths locales no existen para el renderer. Puede listar y enlazar, nunca incrustar. |

Conclusión: **V0+V1 (artifact + summary + comentario sticky con links) es lo
barato y de alto valor; la imagen embebida (V2) exige hosting propio y una
decisión de seguridad aparte.**

## Decisión propuesta

### P1. V0 — subir el diff como artifact, solo en fallo

Paso `id: visual` + upload con
`if: failure() && steps.visual.conclusion == 'failure'`. Detalle que importa:
un fallo por baseline **ausente** bajo `CI=true` no escribe diff (el
gate-harness lo documenta) ⇒ `if-no-files-found: warn`, no `error`. Nombre de
artifact fijo (`visual-diffs-<run_id>`), nunca derivado de nombres de
historias (upload-artifact prohíbe `":<>|*?"` y saltos de línea).

### P2. V1 — comentario sticky desde un job separado sin código

`ci.yml` hoy no declara `permissions:` — y comentar exige
`pull-requests: write`. El diseño que no amplía la superficie: job separado
`visual-report` con `needs: ci`, `if: failure()`, permisos a nivel de **job**,
que **no instala dependencias ni ejecuta código del repo** — solo
`download-artifact` + `github-script`. Así el token con write jamás convive
con código arbitrario de dependencias. El job `ci` queda intacto.

Comentario sticky (buscar y actualizar por marcador HTML oculto) para no
acumular ruido por push. Contenido: historias fallidas, link al artifact, y
la ruta de recuperación que el nombre del paso ya enseña ("dispatch
visual-baselines.yml") — el rojo se vuelve accionable. Los nombres de test
se escapan siguiendo el precedente `cell()` de `audit-usage.js` (pipes y los
tres terminadores de línea), aunque hoy sean repo-controlled: "escapar cuesta
nada aunque el valor ya esté constreñido".

### P3. En forks, el comentario es tolerante; `pull_request_target` está prohibido

Bajo `pull_request` desde un fork el token queda read-only aunque se declare
write ⇒ el paso de comentario debe ser condicional/tolerante, nunca fallar el
job. `pull_request_target` daría write pero ejecuta en contexto privilegiado
(RCE si se combina con checkout del head): prohibido en este diseño. El
patrón seguro (`workflow_run`) es innecesario hoy — el repo ya asume ramas
same-repo (`ADR-0009` nombra la limitación).

### P4. V2 (imagen inline) se difiere y se registra como palanca

La rama huérfana con `contents: write` queda documentada como palanca **no
implementada** — el mismo patrón que `ADR-0008` usa con
`parameters.visual.target`. Si algún día se activa, es su propio PR con su
propia discusión de seguridad.

## Plan de implementación

| Fase | Contenido | Estimado | Estado |
|---|---|---|---|
| V0 | upload-artifact + step summary con lista y link | 30–50 líneas | **Hecha** — `ci.yml`, pasos `Upload the visual diffs` y `Summarise the visual diffs`, guardados por `steps.visual.conclusion` |
| V1 | Job `visual-report` + comentario sticky + escape | 100–150 líneas | Diferida — exige `pull-requests: write` |

V0 entró sola, sin V1: el `pull-requests: write` que V1 necesita es una
decisión de superficie de permisos que no tiene por qué viajar en el mismo PR
que el paso que ya vuelve visible el diff. V2 diferida (P4).

## Alternativas consideradas

**Chromatic u otro SaaS.** Fuera de la filosofía del repo (infra propia,
$0, sin servicios de terceros en el camino del gate).

**`pull_request_target` para que los forks comenten.** Descartada:
superficie RCE conocida.

**Imagen embebida vía rama huérfana desde el día uno.** Diferida: exige
`contents: write` y limpieza; contradice el least-privilege medido de
`visual-baselines.yml` y `audit-ds-usage.yml`.

## Riesgos

1. **Mayor**: ampliar permisos del token en un job que ejecuta código de
   dependencias — mitigado estructuralmente con el job separado sin código.
2. Comentarios ruidosos — mitigado con sticky + solo-en-fallo.
3. Nombres de artifact con caracteres prohibidos — nombre fijo.

## Sinergia inmediata, sin implementar nada

Las 38 baselines ya comprometidas en `stories/__screenshots__/` tienen URL
raw embebible desde `main` — **el screenshot que le falta al README se
resuelve hoy**, sin esperar esta propuesta.
