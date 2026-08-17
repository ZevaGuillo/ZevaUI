// Slot-recipe counterpart to recipe-class.ts. Isolates Panda's `{base}__{slot}` convention in
// one place, for the same reason: a convention mismatch must surface as a failing test, never as
// a silent unstyled ship.
//
// Measured against real Panda 1.12.0 output, not assumed. The non-obvious half is that a variant
// class is emitted ONLY for the slots that variant actually styles — a `size` axis defined solely
// under the `input` slot produces `.zui-x__input--size_md` and NO `--size_md` rule for the other
// slots. So this helper filters per slot rather than stamping every axis onto every slot; doing
// the latter would hand the DOM class names that match no rule.
//
// Three refinements, all from re-running that spike:
//   * The filter is per (axis, VALUE, slot), not per (axis, slot): one axis can style `input` for
//     its `on` value and `label` for its `off` value, and Panda emits each accordingly.
//   * A style object that is declared but EMPTY (`{ root: {} }`) emits no rule, so it must emit
//     no class. Presence of the slot key is therefore not enough; it needs a declaration.
//   * Panda's own generated `sva` runtime does NOT filter — it stamps every axis onto every slot
//     and hands the DOM classes that match no rule. Filtering here is a deliberate improvement,
//     not a mirror of that runtime, and it is safe precisely because this package never ships
//     Panda's generated runtime (G7 in __tests__/emit-gates.test.ts).
//
// A slot's BASE class is always rendered, even for a slot Panda emits no base rule for: it is the
// component's stable structural hook, and a slot with no base styles today can gain them without
// changing any consumer's DOM. `emittedSlotClassNames` deliberately reports less than this, since
// the manifest advertises selectors that exist.
import { variantClassName } from "./recipe-class.js";

export const slotClassName = (base: string, slot: string) => `${base}__${slot}`;

type SlotRecipeShape = {
  className: string;
  slots: readonly string[];
  /** slot -> style object. */
  base?: Record<string, unknown>;
  /** axis -> value -> slot -> style object. */
  variants: Record<string, Record<string, Record<string, unknown>>>;
  defaultVariants?: Record<string, string>;
};

/**
 * Panda emits a rule for a slot only when that slot has at least one declaration: both a missing
 * slot key and a declared-but-empty style object produce no rule, and so must produce no class.
 * The style object is deliberately read as `unknown` — nothing here inspects a CSS property.
 */
const hasDeclarations = (styles: unknown): boolean =>
  typeof styles === "object" && styles !== null && Object.keys(styles).length > 0;

export function slotRecipeClassNames<Recipe extends SlotRecipeShape>(
  recipe: Recipe,
  selected: Readonly<Record<string, string | undefined>>,
): Record<Recipe["slots"][number], string> {
  const classNames = {} as Record<string, string>;

  for (const slot of recipe.slots) {
    const parts = [slotClassName(recipe.className, slot)];

    for (const [axis, values] of Object.entries(recipe.variants)) {
      const value = selected[axis] ?? recipe.defaultVariants?.[axis];
      if (value === undefined) continue;

      // A value the axis does not declare emits no rule, so it must not emit a class either.
      const styles = values[value];
      if (styles === undefined) continue;

      // The per-slot filter described above: only slots this variant value actually styles.
      if (!hasDeclarations(styles[slot])) continue;

      parts.push(variantClassName(slotClassName(recipe.className, slot), axis, value));
    }

    classNames[slot] = parts.join(" ");
  }

  return classNames as Record<Recipe["slots"][number], string>;
}

/**
 * Every class name Panda emits a rule for, in a stable derivation order: each slot's base class
 * that has declarations, then per axis, per value, per styled slot.
 *
 * This is what the manifest advertises and what gate G5 demands of the stylesheet — deliberately
 * a subset of what `slotRecipeClassNames` renders, which additionally carries the structural hook
 * of every slot. Never a hand-written list (ADR-0004 D4).
 */
export function emittedSlotClassNames(recipe: SlotRecipeShape): string[] {
  const classNames: string[] = [];

  for (const slot of recipe.slots) {
    if (!hasDeclarations(recipe.base?.[slot])) continue;
    classNames.push(slotClassName(recipe.className, slot));
  }

  for (const [axis, values] of Object.entries(recipe.variants)) {
    for (const [value, styles] of Object.entries(values)) {
      for (const slot of recipe.slots) {
        if (!hasDeclarations(styles[slot])) continue;
        classNames.push(variantClassName(slotClassName(recipe.className, slot), axis, value));
      }
    }
  }

  return classNames;
}
