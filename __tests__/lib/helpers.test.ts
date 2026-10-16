import { eventGlyph, eventShareUrl, isSoldOut, locationLabel, minTicketPrice, priceLabel } from '../../lib/eventHelpers';
import { buildTheme, resolveScheme, shadow } from '../../lib/theme';
import {
  dateBlockParts,
  eventFormatLabel,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
  pluralize,
  sameDay,
  weekDays,
} from '../../lib/format';
import type { TicketType } from '../../lib/types';

const tt = (price: number, quantity: number | null = null, sold = 0): TicketType => ({
  id: String(price),
  event_id: 'e',
  name: 'GA',
  price_cents: price,
  quantity,
  tickets_sold: sold,
  created_at: '',
});

describe('event helpers', () => {
  it('price labels', () => {
    expect(priceLabel({ is_paid: false, ticket_types: [] })).toBe('Free');
    expect(priceLabel({ is_paid: true, ticket_types: [] })).toBe('Tickets');
    expect(priceLabel({ is_paid: true, ticket_types: [tt(1500)] })).toBe('$15.00');
    expect(priceLabel({ is_paid: true, ticket_types: [tt(2500), tt(1000)] })).toBe('From $10.00');
    expect(minTicketPrice({ is_paid: false, ticket_types: [tt(5)] })).toBeNull();
  });

  it('location labels', () => {
    expect(locationLabel({ format: 'online' })).toBe('Online');
    expect(locationLabel({ format: 'in_person', venue_name: 'Grace Hall', city: 'Philly' })).toBe('Grace Hall');
    expect(locationLabel({ format: 'hybrid', city: 'Philly' })).toBe('Philly · Online');
    expect(locationLabel({ format: 'in_person' })).toBe('Location TBA');
  });

  it('sold out detection', () => {
    expect(isSoldOut({ is_paid: true, going_count: 0, ticket_types: [tt(1, 10, 10), tt(2, 5, 5)] })).toBe(true);
    expect(isSoldOut({ is_paid: true, going_count: 0, ticket_types: [tt(1, 10, 10), tt(2, null, 50)] })).toBe(false);
    expect(isSoldOut({ is_paid: false, going_count: 50, max_capacity: 50, ticket_types: [] })).toBe(true);
    expect(isSoldOut({ is_paid: false, going_count: 5, ticket_types: [] })).toBe(false);
  });

  it('share URL and glyphs', () => {
    expect(eventShareUrl('e1')).toBe('https://christlinksocial.com/event/e1');
    expect(eventGlyph({ emoji: '🔥' })).toBe('🔥');
    expect(eventGlyph({ event_type: 'Bible Study' })).toBe('📖');
    expect(eventGlyph({ event_type: 'Unknown' })).toBe('✝️');
  });
});

describe('theme', () => {
  it('follows the system unless overridden', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('builds a theme with reduce-motion flag', () => {
    const t = buildTheme('light', true);
    expect(t.c.bg).toBe('#F7F2E8');
    expect(t.reduceMotion).toBe(true);
    expect(shadow(2, '#000').elevation).toBe(6);
  });
});

describe('format helpers', () => {
  it('formats dates and TBA states', () => {
    expect(formatDateLong(null)).toBe('Date to be announced');
    expect(formatDateShort(undefined)).toBe('TBA');
    expect(formatTime(null)).toBe('');
    expect(formatTimeRange(null)).toBe('');
    const iso = new Date(2026, 9, 15, 19, 30).toISOString();
    expect(formatTime(iso)).toMatch(/7:30/);
    expect(formatTimeRange(iso, new Date(2026, 9, 15, 21).toISOString())).toMatch(/7:30.*–.*9:00/);
    expect(dateBlockParts(iso)).toEqual({ month: 'OCT', day: '15', weekday: 'Thu' });
    expect(dateBlockParts(null).month).toBe('TBA');
  });

  it('week strip and labels', () => {
    const days = weekDays(new Date(2026, 9, 15, 13));
    expect(days).toHaveLength(7);
    expect(sameDay(days[1], new Date(2026, 9, 16, 22).toISOString())).toBe(true);
    expect(sameDay(days[0], null)).toBe(false);
    expect(pluralize(1, 'ticket')).toBe('1 ticket');
    expect(pluralize(3, 'person', 'people')).toBe('3 people');
    expect(eventFormatLabel('hybrid')).toBe('Hybrid');
    expect(eventFormatLabel(undefined)).toBe('In person');
  });
});
