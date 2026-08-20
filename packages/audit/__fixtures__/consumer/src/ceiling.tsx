// Three documented blind spots (RF-UAW05), asserted absent from the
// expected report rather than silently working by accident: a namespace
// import, a dynamic import(), and a type-only import.
import * as Zui from "@zevaui/components";
import type { ButtonProps } from "@zevaui/components";

export async function loadButtonDynamically() {
  const mod = await import("@zevaui/components");
  return mod;
}

export const Namespace = Zui;
export type Props = ButtonProps;
