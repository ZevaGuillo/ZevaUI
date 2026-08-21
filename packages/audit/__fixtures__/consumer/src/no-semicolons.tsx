// ASI must-find cases (RF-UAW04). Every other fixture in this directory ends
// its imports with a semicolon, and that uniformity is exactly what let a
// scanner that bounded declarations on `;` pass 31 tests while silently
// dropping every import in this style. Prettier with `semi: false` and
// Standard both emit it, so a consumer written this way is ordinary, not
// exotic — and its failure mode was an empty components[] with exit 0.
//
// Biome does not touch this directory (biome.json excludes __fixtures__),
// so the absent semicolons survive a format run.
import { Badge } from "@zevaui/components"
import {
  Tooltip,
} from "@zevaui/components"

// Guards, not must-finds. Both resolve to no component names, and both would
// break a naive "no semicolon means read to the end of the window" fix:
// `import.meta` must not reach forward into the from clause below it.
const buildUrl = import.meta.url
import * as Semi from "@zevaui/components"

export function SemicolonFree() {
  return (
    <Tooltip label={buildUrl}>
      <Badge tone="info">ok</Badge>
    </Tooltip>
  )
}

export const Namespaced = Semi
