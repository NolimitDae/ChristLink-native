import { formatCents } from './fees';

/** Daily values for the last `days` days (oldest first) from `{ day: 'YYYY-MM-DD' }` rows. */
export function lastDays<T extends { day: string }>(rows: T[], pick: (r: T) => number, days = 30, now = new Date()): number[] {
  const byDay = new Map(rows.map(r => [r.day, pick(r)]));
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  return out;
}

/** "100% off" / "$5.00 off" for a listing-fee promo code (fixed amounts are dollars, as the API stores them). */
export function promoLabel(p: { discount_type: 'percent' | 'fixed'; discount_value: number }) {
  return p.discount_type === 'percent' ? `${p.discount_value}% off` : `${formatCents(Math.round(p.discount_value * 100))} off`;
}
