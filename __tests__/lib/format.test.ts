import {
  countdownLabel,
  eventTiming,
  firstName,
  friendsGoingLabel,
  greeting,
  isTonight,
  isWithinDays,
  timeAgo,
} from '../../lib/format';

const H = 3_600_000;

describe('eventTiming badges', () => {
  const now = new Date(2026, 9, 15, 18).getTime();
  it('LIVE while the event runs (default 2h when no end)', () => {
    expect(eventTiming(new Date(now - H).toISOString(), null, now)).toEqual({ kind: 'live' });
  });
  it('Starts in within 24h', () => {
    expect(eventTiming(new Date(now + 2 * H + 10 * 60_000).toISOString(), null, now)).toEqual({ kind: 'startsIn', label: '2h 10m' });
  });
  it('upcoming, past and tba', () => {
    expect(eventTiming(new Date(now + 48 * H).toISOString(), null, now).kind).toBe('upcoming');
    expect(eventTiming(new Date(now - 5 * H).toISOString(), new Date(now - 3 * H).toISOString(), now).kind).toBe('past');
    expect(eventTiming(undefined, undefined, now).kind).toBe('tba');
  });
});

describe('countdownLabel', () => {
  it.each([
    [0, 'now'],
    [30_000, '1m'],
    [45 * 60_000, '45m'],
    [3 * H, '3h 0m'],
    [27 * H, '1d 3h'],
  ])('%i ms → %s', (ms, label) => expect(countdownLabel(ms)).toBe(label));
});

describe('friendsGoingLabel', () => {
  it('names friends first', () => {
    expect(friendsGoingLabel(['Sarah Lee', 'Ben', 'Ana'], 5, 40)).toBe('Sarah + 4 friends going');
    expect(friendsGoingLabel(['Sarah Lee', 'Ben Cole'], 2, 40)).toBe('Sarah and Ben going');
    expect(friendsGoingLabel(['Sarah Lee'], 1, 40)).toBe('Sarah is going');
  });
  it('falls back to attendee count', () => {
    expect(friendsGoingLabel([], 0, 128)).toBe('128 going');
    expect(friendsGoingLabel([], 0, 0)).toBe('Be the first to go');
  });
});

describe('dates', () => {
  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
  it('detects tonight and this week', () => {
    const now = new Date(2026, 9, 15, 12);
    expect(isTonight(new Date(2026, 9, 15, 19).toISOString(), now)).toBe(true);
    expect(isTonight(new Date(2026, 9, 15, 9).toISOString(), now)).toBe(false);
    expect(isTonight(new Date(2026, 9, 16, 19).toISOString(), now)).toBe(false);
    expect(isWithinDays(new Date(2026, 9, 20).toISOString(), 7, now)).toBe(true);
    expect(isWithinDays(new Date(2026, 9, 30).toISOString(), 7, now)).toBe(false);
  });
  it('timeAgo', () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 10_000).toISOString(), now)).toBe('just now');
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m');
    expect(timeAgo(new Date(now - 3 * H).toISOString(), now)).toBe('3h');
  });
  it('firstName', () => {
    expect(firstName('  Elizabeth  Awokoya ')).toBe('Elizabeth');
    expect(firstName(undefined)).toBe('');
  });
});
