import { lastDays, promoLabel } from '../../lib/admin';

describe('admin dashboard helpers', () => {
  it('lastDays fills a 30-day series oldest first, with zero for missing days', () => {
    const now = new Date(Date.UTC(2026, 10, 14, 15));
    const rows = [
      { day: '2026-11-14', n: 3 },
      { day: '2026-11-12', n: 2 },
      { day: '2026-10-01', n: 9 },
    ];
    const series = lastDays(rows, r => r.n, 30, now);
    expect(series).toHaveLength(30);
    expect(series[29]).toBe(3);
    expect(series[28]).toBe(0);
    expect(series[27]).toBe(2);
    expect(series.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('promoLabel', () => {
    expect(promoLabel({ discount_type: 'percent', discount_value: 100 })).toBe('100% off');
    expect(promoLabel({ discount_type: 'fixed', discount_value: 5 })).toBe('$5.00 off');
    expect(promoLabel({ discount_type: 'fixed', discount_value: 19.99 })).toBe('$19.99 off');
  });
});
