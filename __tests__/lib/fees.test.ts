import {
  computeBreakdown,
  formatCents,
  parseDollarsToCents,
  paymentIntentIdFromSecret,
  salesPerDay,
  summarizeSales,
} from '../../lib/fees';

describe('computeBreakdown matches the production server', () => {
  // Expected values captured from GET /api/price-breakdown on 2026-10-15.
  it.each([
    [1500, 1, true, { face: 1500, chargeAmount: 1605, platformFee: 105, stripeFee: 77, hostReceives: 1423 }],
    [1500, 1, false, { face: 1500, chargeAmount: 1684, platformFee: 105, stripeFee: 79, hostReceives: 1500 }],
    [1999, 3, true, { face: 5997, chargeAmount: 6417, platformFee: 420, stripeFee: 216, hostReceives: 5781 }],
    [1999, 3, false, { face: 5997, chargeAmount: 6640, platformFee: 420, stripeFee: 223, hostReceives: 5997 }],
    [333, 7, true, { face: 2331, chargeAmount: 2494, platformFee: 163, stripeFee: 102, hostReceives: 2229 }],
  ])('price %i × %i absorb=%s', (price, qty, absorb, expected) => {
    expect(computeBreakdown(price, qty, absorb)).toMatchObject(expected);
  });

  it('shows the $15 ticket as $15 + 7% fee as separate lines', () => {
    const b = computeBreakdown(1500, 1);
    expect(formatCents(b.face)).toBe('$15.00');
    expect(formatCents(b.platformFee)).toBe('$1.05');
    expect(formatCents(b.chargeAmount)).toBe('$16.05');
  });
});

describe('computeBreakdown edge cases', () => {
  it('free (or fully discounted) tickets cost nothing and never go negative', () => {
    expect(computeBreakdown(0, 1)).toEqual({ face: 0, discount: 0, platformFee: 0, chargeAmount: 0, stripeFee: 0, hostReceives: 0 });
    expect(computeBreakdown(1000, 2, true, 5000)).toMatchObject({ face: 0, discount: 2000, chargeAmount: 0, hostReceives: 0 });
  });

  it('applies the fee to the discounted face value', () => {
    const b = computeBreakdown(2000, 1, true, 500);
    expect(b.face).toBe(1500);
    expect(b.platformFee).toBe(105);
  });

  it('rounds half cents consistently', () => {
    // 7% of 2150 = 150.5 → 151 (Math.round, same as the server)
    expect(computeBreakdown(2150, 1).platformFee).toBe(151);
  });

  it('rejects invalid input', () => {
    expect(() => computeBreakdown(-1, 1)).toThrow();
    expect(() => computeBreakdown(100, 0)).toThrow();
    expect(() => computeBreakdown(100, 1.5)).toThrow();
  });
});

describe('money parsing', () => {
  it.each([
    ['15', 1500],
    ['15.5', 1550],
    ['$15.50', 1550],
    ['1,250.99', 125099],
    ['0', 0],
  ])('parses %s', (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it.each(['', 'abc', '15.555', '-3'])('rejects %s', input => expect(parseDollarsToCents(input)).toBeNull());

  it('formats cents', () => {
    expect(formatCents(0, { free: 'Free' })).toBe('Free');
    expect(formatCents(-250)).toBe('-$2.50');
  });

  it('extracts the PaymentIntent id for the confirm-by-intent fallback', () => {
    expect(paymentIntentIdFromSecret('pi_3Abc123_secret_xyz')).toBe('pi_3Abc123');
    expect(paymentIntentIdFromSecret('nonsense')).toBeNull();
  });
});

describe('host sales summary', () => {
  const tickets = [
    { status: 'confirmed', quantity: 1, total_charged_cents: 1605, platform_fee_cents: 105, stripe_fee_cents: 77, host_receives_cents: 1423 },
    { status: 'confirmed', quantity: 2, total_charged_cents: 3210, platform_fee_cents: 210, stripe_fee_cents: 123, host_receives_cents: 2877 },
    { status: 'confirmed', quantity: 1, total_charged_cents: 1605, platform_fee_cents: 105, stripe_fee_cents: 77, host_receives_cents: 1423 },
    { status: 'refunded', quantity: 1, total_charged_cents: 1605, platform_fee_cents: 105, stripe_fee_cents: 77, host_receives_cents: 1423 },
    { status: 'pending', quantity: 1, total_charged_cents: 1605 },
  ];

  it('separates gross, fees, refunds and net (3 sales + 1 refund)', () => {
    expect(summarizeSales(tickets, 4)).toEqual({
      ticketsSold: 4,
      freeRsvps: 4,
      gross: 6420,
      fees: 697,
      refunds: 1605,
      net: 5723,
    });
  });

  it('a refund after payout does not inflate net earnings', () => {
    const s = summarizeSales(tickets, 0);
    expect(s.net).toBe(1423 + 2877 + 1423);
  });

  it('buckets confirmed sales per day for the sparkline', () => {
    const now = new Date(2026, 9, 15, 12);
    const rows = [
      { status: 'confirmed', quantity: 2, created_at: new Date(2026, 9, 15, 9).toISOString() },
      { status: 'confirmed', quantity: 1, created_at: new Date(2026, 9, 13, 20).toISOString(), confirmed_at: new Date(2026, 9, 14, 8).toISOString() },
      { status: 'refunded', quantity: 5, created_at: new Date(2026, 9, 15, 9).toISOString() },
      { status: 'confirmed', quantity: 9, created_at: new Date(2026, 8, 1).toISOString() },
    ];
    expect(salesPerDay(rows, 3, now)).toEqual([0, 1, 2]);
  });
});
