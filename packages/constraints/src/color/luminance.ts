import type { LinearRgb } from "./parse.js";

const RED_COEFFICIENT = 0.2126;
const GREEN_COEFFICIENT = 0.7152;
const BLUE_COEFFICIENT = 0.0722;

export function relativeLuminance({ r, g, b }: LinearRgb): number {
  return RED_COEFFICIENT * r + GREEN_COEFFICIENT * g + BLUE_COEFFICIENT * b;
}
