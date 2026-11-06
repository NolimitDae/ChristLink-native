import { visitOptions } from '../../components/church/churchFormat';
import type { ChurchRecurringEvent } from '../../lib/types';

const midweek: ChurchRecurringEvent = {
  id: 'r1', church_id: 'c1', name: 'Wednesday Prayer', frequency: 'weekly', weekday: 3, start_time: '19:00',
  duration_minutes: 60, starts_on: '2026-01-07', is_service: true,
};
const smallGroup: ChurchRecurringEvent = { ...midweek, id: 'r2', name: 'Small group', is_service: false };

describe('plan a visit', () => {
  it('lists the next services over two weeks, soonest first, capped', () => {
    const now = new Date(2026, 10, 2, 12); // Monday
    const opts = visitOptions({ service_times: [{ day: 0, time: '10:00' }] }, [midweek, smallGroup], now);
    expect(opts.map(o => [o.title, o.date.getDate(), o.date.getHours()])).toEqual([
      ['Wednesday Prayer', 4, 19],
      ['Sunday service', 8, 10],
      ['Wednesday Prayer', 11, 19],
      ['Sunday service', 15, 10],
    ]);
    expect(opts[0].minutes).toBe(60);
  });
  it('returns nothing without services', () => {
    expect(visitOptions({ service_times: [] }, [smallGroup], new Date(2026, 10, 2))).toEqual([]);
  });
});
