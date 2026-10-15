/**
 * Client-side mirror of the server's fee math (server.js /api/price-breakdown).
 * Used to show an instant estimate; the server response is always the source of truth.
 * Verified against production: price=1500, qty=1, absorb=true →
 * { face: 1500, platformFee: 105, chargeAmount: 1605, stripeFee: 77, hostReceives: 1423 }.
 */
export const PLATFORM_FEE_RATE = 0.07;
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;
export const LISTING_FEE_CENTS = 1999;

export interface PriceBreakdown {
  face: number;
  discount: number;
  platformFee: number;
  chargeAmount: number;
  stripeFee: number;
  hostReceives: number;
}

export function computeBreakdown(
  unitPriceCents: number,
  qty: number,
  absorbStripeFee = true,
  discountCents = 0,
): PriceBreakdown {
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) throw new Error('Invalid price');
  if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity');
  const gross = Math.round(unitPriceCents) * qty;
  const discount = Math.min(Math.max(0, Math.round(discountCents)), gross);
  const face = gross - discount;
  if (face === 0) {
    return { face: 0, discount, platformFee: 0, chargeAmount: 0, stripeFee: 0, hostReceives: 0 };
  }
  const platformFee = Math.round(face * PLATFORM_FEE_RATE);
  let chargeAmount = face + platformFee;
  let stripeFee = Math.round(chargeAmount * STRIPE_PERCENT + STRIPE_FIXED_CENTS);
  if (!absorbStripeFee) {
    // Buyer covers processing: gross up so the host still receives the face value.
    chargeAmount = Math.round((face + platformFee + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
    stripeFee = chargeAmount - face - platformFee;
  }
  const hostReceives = absorbStripeFee ? face - stripeFee : face;
  return { face, discount, platformFee, chargeAmount, stripeFee, hostReceives };
}

export function formatCents(cents: number, opts: { free?: string } = {}): string {
  if (cents === 0 && opts.free) return opts.free;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Parse a dollar string typed by a host ("15", "15.5", "$15.50") into cents, or null when invalid. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** Stripe PaymentIntent id from a client secret ("pi_123_secret_abc" → "pi_123"). */
export function paymentIntentIdFromSecret(clientSecret: string): string | null {
  const match = /^(pi_[A-Za-z0-9]+)_secret_/.exec(clientSecret);
  return match ? match[1] : null;
}

export interface SalesSummary {
  ticketsSold: number;
  freeRsvps: number;
  gross: number;
  fees: number;
  refunds: number;
  net: number;
}

export interface SaleRow {
  status: string;
  quantity: number;
  total_charged_cents: number;
  platform_fee_cents?: number | null;
  stripe_fee_cents?: number | null;
  host_receives_cents?: number | null;
}

/** Host-facing totals computed from ticket rows, so refunds and fees show as separate lines. */
export function summarizeSales(tickets: SaleRow[], freeRsvps: number): SalesSummary {
  let ticketsSold = 0;
  let gross = 0;
  let fees = 0;
  let refunds = 0;
  let net = 0;
  for (const t of tickets) {
    if (t.status === 'confirmed') {
      ticketsSold += t.quantity;
      gross += t.total_charged_cents;
      fees += (t.platform_fee_cents ?? 0) + (t.stripe_fee_cents ?? 0);
      net += t.host_receives_cents ?? 0;
    } else if (t.status === 'refunded') {
      refunds += t.total_charged_cents;
    }
  }
  return { ticketsSold, freeRsvps, gross, fees, refunds, net };
}

/** Bucket confirmed sales per calendar day for the sparkline (oldest → newest). */
export function salesPerDay(rows: { confirmed_at?: string | null; created_at: string; quantity: number; status: string }[], days = 14, now = new Date()): number[] {
  const buckets = new Array<number>(days).fill(0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const r of rows) {
    if (r.status !== 'confirmed') continue;
    const ts = new Date(r.confirmed_at ?? r.created_at);
    const day = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).getTime();
    const idx = days - 1 - Math.round((end - day) / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx] += r.quantity;
  }
  return buckets;
}
