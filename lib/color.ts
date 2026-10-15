const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const SOLID = /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]*\)|hsla?\([^)]*\))$/;

/**
 * The web app stores avatar colors as CSS (sometimes `linear-gradient(135deg,#059669,#064E3B)`),
 * which React Native cannot render. Return a solid color React Native accepts.
 */
export function solidColor(input: string | null | undefined, fallback: string): string {
  if (!input) return fallback;
  const v = input.trim();
  if (SOLID.test(v)) return v;
  const hex = HEX.exec(v);
  return hex ? hex[0] : fallback;
}

/** Two gradient stops from a CSS gradient, or null for solid colors. */
export function gradientStops(input: string | null | undefined): [string, string] | null {
  if (!input || !input.includes('gradient')) return null;
  const matches = input.match(new RegExp(HEX.source, 'g'));
  if (!matches || matches.length < 2) return null;
  return [matches[0], matches[matches.length - 1]];
}

/** Black or ivory text, whichever reads better on the given hex background. */
export function readableOn(hex: string): '#14110E' | '#F6EFE3' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3'));
  if (!m) return '#F6EFE3';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#14110E' : '#F6EFE3';
}
