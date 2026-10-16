import type { Prayer } from '../../lib/types';

const CHARS_PER_LINE = 24;
const LINE_HEIGHT = 22;
const BASE_HEIGHT = 128;
const MAX_BODY_LINES = 12;

/** Rough card height, used only to balance the two masonry columns. */
export function estimatePrayerHeight(p: Pick<Prayer, 'body' | 'answered_at' | 'testimony' | 'is_mine'>): number {
  const lines = Math.min(MAX_BODY_LINES, Math.ceil(p.body.length / CHARS_PER_LINE));
  let h = BASE_HEIGHT + lines * LINE_HEIGHT;
  if (p.answered_at) h += 34;
  if (p.testimony) h += 40 + Math.min(4, Math.ceil(p.testimony.length / CHARS_PER_LINE)) * 20;
  if (p.is_mine && !p.answered_at) h += 40;
  return h;
}

/** Places each item into whichever column is currently shorter, preserving order within a column. */
export function distributeColumns<T>(items: T[], estimate: (item: T) => number): [T[], T[]] {
  const cols: [T[], T[]] = [[], []];
  const heights = [0, 0];
  for (const item of items) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    cols[target].push(item);
    heights[target] += estimate(item);
  }
  return cols;
}
