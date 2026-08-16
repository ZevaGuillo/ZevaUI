export type LinearRgb = { readonly r: number; readonly g: number; readonly b: number };

type Oklch = { readonly l: number; readonly c: number; readonly h: number };

const OKLCH = /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/;

export function parseColor(input: string): LinearRgb | undefined {
  const normalized = input.trim().toLowerCase();

  const oklchMatch = normalized.match(OKLCH);
  if (oklchMatch) return parseOklchMatch(oklchMatch);

  const hexMatch = normalized.match(HEX);
  if (hexMatch) return parseHexMatch(hexMatch[1]);

  return undefined;
}

function parseOklchMatch(match: RegExpMatchArray): LinearRgb | undefined {
  const l = Number(match[1]);
  const c = Number(match[2]);
  const h = Number(match[3]);
  if (![l, c, h].every(Number.isFinite)) return undefined;

  return oklchToLinearSrgb({ l, c, h });
}

function parseHexMatch(digits: string): LinearRgb {
  const expanded = digits.length === 3 ? expandShortHex(digits) : digits;
  const r = decodeHexChannel(expanded.slice(0, 2));
  const g = decodeHexChannel(expanded.slice(2, 4));
  const b = decodeHexChannel(expanded.slice(4, 6));
  return { r, g, b };
}

function expandShortHex(digits: string): string {
  return digits
    .split("")
    .map((digit) => digit + digit)
    .join("");
}

// Hex is gamma-encoded sRGB, so it is decoded to linear light. The input is in
// range by construction, so no clamping is needed here.
function decodeHexChannel(byteHex: string): number {
  const v = Number.parseInt(byteHex, 16) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

// OKLab->linear-sRGB matrices from Björn Ottosson's published OKLab conversion
// (https://bottosson.github.io/posts/oklab/). Step 4 below already emits
// linear-light sRGB, so there is NO gamma-decode on this path: WCAG's
// ((c+0.055)/1.055)**2.4 formula exists solely to undo the sRGB transfer
// function on gamma-ENCODED input, and applying it here would decode a value
// that was never encoded in the first place.
function oklchToLinearSrgb({ l: L, c, h }: Oklch): LinearRgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r: clamp01(r), g: clamp01(g), b: clamp01(bb) };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
