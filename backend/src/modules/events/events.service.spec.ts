import { BadRequestException } from '@nestjs/common';
import { couponQuote, pickEventFields, ticketTypeChangeError } from './events.service';
import { haversineMiles, isUuid, sanitizeText, toDate, toInt } from './event-helpers';

describe('events helpers', () => {
  it('ticketTypeChangeError refuses quantity below sold and price changes after a sale', () => {
    expect(ticketTypeChangeError({ sold: 5, price_cents: 1000 }, 4, undefined)).toMatch(/5 tickets already sold/);
    expect(ticketTypeChangeError({ sold: 5, price_cents: 1000 }, 5, undefined)).toBeNull();
    expect(ticketTypeChangeError({ sold: 5, price_cents: 1000 }, null, undefined)).toBeNull(); // unlimited
    expect(ticketTypeChangeError({ sold: 1, price_cents: 1000 }, undefined, 1200)).toMatch(/Price can't change/);
    expect(ticketTypeChangeError({ sold: 1, price_cents: 1000 }, undefined, 1000)).toBeNull();
    expect(ticketTypeChangeError({ sold: null, price_cents: 1000 }, 1, 50)).toBeNull();
  });

  it('couponQuote matches server.js (fixed values are dollars)', () => {
    expect(couponQuote({ id: 'c', discount_type: 'percent', discount_value: 10 }, 2500, 2)).toEqual({
      valid: true, couponId: 'c', discountType: 'percent', discountValue: 10, discountCents: 500, newTotal: 4500, label: '10% off',
    });
    const fixed = couponQuote({ id: 'c', discount_type: 'fixed', discount_value: 50 }, 2000, undefined);
    expect(fixed).toMatchObject({ discountCents: 2000, newTotal: 0, label: '$50.00 off' });
  });

  it('pickEventFields picks, sanitizes and type-checks', () => {
    expect(pickEventFields({ name: '<b>Hi</b> ', max_capacity: '40', host_id: 'x', start_date: '2030-01-01T10:00:00Z' }, ['name', 'max_capacity', 'start_date']))
      .toEqual({ name: 'Hi', max_capacity: 40, start_date: new Date('2030-01-01T10:00:00Z') });
    expect(() => pickEventFields({ tags: 'x' }, ['tags'])).toThrow(BadRequestException);
    expect(() => pickEventFields({ is_paid: 'yes' }, ['is_paid'])).toThrow(BadRequestException);
  });

  it('small helpers', () => {
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isUuid('nope')).toBe(false);
    expect(sanitizeText('<script>x</script>ok')).toBe('xok');
    expect(toDate('', 'd')).toBeNull();
    expect(() => toDate('garbage', 'd')).toThrow(BadRequestException);
    expect(() => toInt('1.5', 'n')).toThrow(BadRequestException);
    expect(Math.round(haversineMiles(40.7128, -74.006, 34.0522, -118.2437))).toBe(2446);
  });
});
