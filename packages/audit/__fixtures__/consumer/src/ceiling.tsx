// Three documented blind spots (RF-UAW05), asserted absent from the
// expected report rather than silently working by accident: a namespace
// import, a dynamic import(), and a type-only import. All three share the
// same reason: no component NAME is statically extractable from them, so
// recording them could only ever add specifier-level noise.
import * as Zui from "@zevaui/components";
import type { ButtonProps } from "@zevaui/components";

// The barrel re-export left that list: it carries a real component name and
// undercounted real adoption while asserted absent (ADR-0009 D5). `Menu` is
// deliberately absent from every OTHER fixture file, so it can only reach
// the expected report through this line — the inverse of the old decoy
// discipline, same reasoning: a name that could arrive two ways proves
// nothing (the trap the phantom-import drill measured, see git history: 5.3).
export { Menu } from "@zevaui/components";

export async function loadButtonDynamically() {
  const mod = await import("@zevaui/components");
  return mod;
}

export const Namespace = Zui;
export type Props = ButtonProps;
