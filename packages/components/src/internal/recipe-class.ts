// Isolates Panda's `--{axis}_{value}` class-name convention in one place, so a
// convention mismatch surfaces as a failing test (see G5 in __tests__/css-gates.test.ts)
// rather than as a silent unstyled ship.
export const variantClassName = (base: string, axis: string, value: string) =>
  `${base}--${axis}_${value}`;

export function recipeClassName(
  recipe: {
    className: string;
    variants: Record<string, Record<string, unknown>>;
    defaultVariants?: Record<string, string>;
  },
  selected: Readonly<Record<string, string | undefined>>,
): string {
  const parts = [recipe.className];
  for (const axis of Object.keys(recipe.variants)) {
    const value = selected[axis] ?? recipe.defaultVariants?.[axis];
    if (value !== undefined) parts.push(variantClassName(recipe.className, axis, value));
  }
  return parts.join(" ");
}
