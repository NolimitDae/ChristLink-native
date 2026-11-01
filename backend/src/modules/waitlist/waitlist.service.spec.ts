import { openSeats } from './waitlist.service';

describe('openSeats', () => {
  it('free events count RSVPs against capacity; no capacity means always open', () => {
    expect(openSeats({ is_paid: false, max_capacity: 10 }, 10, [])).toEqual({ kind: 'free', open: 0 });
    expect(openSeats({ is_paid: false, max_capacity: 10 }, 7, [])).toEqual({ kind: 'free', open: 3 });
    expect(openSeats({ is_paid: false, max_capacity: null }, 500, []).open).toBe(Infinity);
  });
  it('paid events add up limited ticket types; any unlimited type is never sold out', () => {
    expect(openSeats({ is_paid: true, max_capacity: null }, 0, [{ quantity: 5, sold: 5 }, { quantity: 2, sold: 1 }]).open).toBe(1);
    expect(openSeats({ is_paid: true, max_capacity: null }, 0, [{ quantity: 5, sold: 7 }]).open).toBe(0);
    expect(openSeats({ is_paid: true, max_capacity: null }, 0, [{ quantity: null, sold: 99 }]).open).toBe(Infinity);
  });
});
