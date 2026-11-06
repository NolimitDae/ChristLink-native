import { calcAmounts, couponDiscountCents, listingDiscountCents } from './fees';
// The app's client-side mirror; the server must agree with it to the cent.
import { computeBreakdown } from '../../../../lib/fees';

describe('calcAmounts', () => {
  // Same fixtures as the app's __tests__/lib/fees.test.ts (captured from production)
  it.each([
    [1500, 1, true, { face: 1500, chargeAmount: 1605, platformFee: 105, stripeFee: 77, hostReceives: 1423 }],
    [1500, 1, false, { face: 1500, chargeAmount: 1684, platformFee: 105, stripeFee: 79, hostReceives: 1500 }],
    [1999, 3, true, { face: 5997, chargeAmount: 6417, platformFee: 420, stripeFee: 216, hostReceives: 5781 }],
    [1999, 3, false, { face: 5997, chargeAmount: 6640, platformFee: 420, stripeFee: 223, hostReceives: 5997 }],
    [333, 7, true, { face: 2331, chargeAmount: 2494, platformFee: 163, stripeFee: 102, hostReceives: 2229 }],
  ])('price %i x %i absorb=%s', (price, qty, absorb, expected) => {
    expect(calcAmounts(price, qty, absorb)).toEqual(expected);
  });

  it('price 0 costs nothing and host earnings are never negative', () => {
    const zero = { face: 0, chargeAmount: 0, platformFee: 0, stripeFee: 0, hostReceives: 0 };
    expect(calcAmounts(0, 1, true)).toEqual(zero);
    expect(calcAmounts(0, 3, false)).toEqual(zero);
  });

  it('matches lib/fees.ts computeBreakdown for absorbed fees', () => {
    for (let price = 1; price <= 20000; price += 37) {
      for (const qty of [1, 2, 5]) {
        const { discount, ...app } = computeBreakdown(price, qty, true);
        expect(discount).toBe(0);
        expect(calcAmounts(price, qty, true)).toEqual(app);
      }
    }
  });
});

describe('discounts', () => {
  it('listing promo', () => {
    expect(listingDiscountCents('percent', 50)).toBe(1000);
    expect(listingDiscountCents('fixed', 5)).toBe(500);
    expect(listingDiscountCents('fixed', 50)).toBe(1999);
  });
  it('event coupon', () => {
    expect(couponDiscountCents('percent', 10, 1500)).toBe(150);
    expect(couponDiscountCents('fixed', 20, 1500)).toBe(1500);
  });
});
