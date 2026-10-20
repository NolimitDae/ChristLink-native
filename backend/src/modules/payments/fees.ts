// Same constants and math as server.js (calcAmounts) and the app's lib/fees.ts. Money is integer cents.
export const PLATFORM_FEE_PCT = 0.07;
export const HOST_LISTING_FEE = 1999;
export const STRIPE_PCT = 0.029;
export const STRIPE_FIXED = 30;

export interface Amounts {
  face: number;
  chargeAmount: number;
  platformFee: number;
  stripeFee: number;
  hostReceives: number;
}

export function calcAmounts(priceCents: number, qty: number, absorb: boolean): Amounts {
  const face = priceCents * qty;
  // Free (or fully discounted): nothing is charged, so no fees and never negative host earnings (server.js bug)
  if (face <= 0) return { face: 0, chargeAmount: 0, platformFee: 0, stripeFee: 0, hostReceives: 0 };
  const platformFee = Math.round(face * PLATFORM_FEE_PCT);
  const baseCharge = face + platformFee;
  const chargeAmount = absorb ? baseCharge : Math.ceil((baseCharge + STRIPE_FIXED) / (1 - STRIPE_PCT));
  const stripeFee = Math.round(chargeAmount * STRIPE_PCT + STRIPE_FIXED);
  const hostReceives = chargeAmount - stripeFee - platformFee;
  return { face, chargeAmount, platformFee, stripeFee, hostReceives };
}

/** Listing promo discount in cents (server.js charge-listing-fee / validate-listing-promo). */
export function listingDiscountCents(discountType: string, discountValue: number): number {
  return discountType === 'percent'
    ? Math.round(HOST_LISTING_FEE * (discountValue / 100))
    : Math.min(Math.round(discountValue * 100), HOST_LISTING_FEE);
}

/** Event coupon discount per ticket in cents (server.js create-payment-intent). */
export function couponDiscountCents(discountType: string, discountValue: number, priceCents: number): number {
  return discountType === 'percent'
    ? Math.round((priceCents * discountValue) / 100)
    : Math.min(discountValue * 100, priceCents);
}
