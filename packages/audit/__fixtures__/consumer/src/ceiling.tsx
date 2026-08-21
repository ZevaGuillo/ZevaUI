// Four documented blind spots (RF-UAW05), asserted absent from the
// expected report rather than silently working by accident: a namespace
// import, a dynamic import(), a type-only import, and a barrel re-export.
import * as Zui from "@zevaui/components";
import type { ButtonProps } from "@zevaui/components";

// The re-exported name is deliberately absent from every must-find: a name
// already in the expected report would be swallowed by components[]'s dedup
// if this ever leaked, and the gate would keep passing while proving nothing
// (the same trap the phantom-import drill measured, see git history: 5.3).
export { Menu } from "@zevaui/components";

export async function loadButtonDynamically() {
  const mod = await import("@zevaui/components");
  return mod;
}

export const Namespace = Zui;
export type Props = ButtonProps;
