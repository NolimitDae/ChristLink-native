import { entryEnd, googleCalendarUrl } from '../../lib/calendar';
import { mapsUrl } from '../../lib/maps';
import { dailyReminderTimes, prayerReminderContent } from '../../lib/reminderTimes';

describe('calendar entries', () => {
  it('defaults to two hours when the end is missing or before the start', () => {
    expect(entryEnd({ start: '2026-11-20T00:00:00.000Z' }).toISOString()).toBe('2026-11-20T02:00:00.000Z');
    expect(entryEnd({ start: '2026-11-20T00:00:00.000Z', end: '2026-11-19T00:00:00.000Z' }).toISOString()).toBe('2026-11-20T02:00:00.000Z');
    expect(entryEnd({ start: '2026-11-20T00:00:00.000Z', end: '2026-11-20T03:30:00.000Z' }).toISOString()).toBe('2026-11-20T03:30:00.000Z');
  });

  it('builds a Google Calendar link in UTC with encoded fields', () => {
    const url = googleCalendarUrl({
      title: 'Night of Worship & Prayer',
      start: '2026-11-20T00:00:00.000Z',
      location: 'The Tabernacle, Atlanta',
      url: 'https://christlinksocial.com/event/1',
    });
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Night%20of%20Worship%20%26%20Prayer');
    expect(url).toContain('dates=20261120T000000Z%2F20261120T020000Z');
    expect(url).toContain('location=The%20Tabernacle%2C%20Atlanta');
    expect(url).toContain('details=https%3A%2F%2Fchristlinksocial.com%2Fevent%2F1');
  });
});

describe('maps links', () => {
  const place = { parts: ['Fox Theatre', null, 'Atlanta'], lat: 33.77, lng: -84.39 };
  it('uses Apple Maps on iOS and prefers coordinates for directions', () => {
    expect(mapsUrl(place, { os: 'ios' })).toBe('http://maps.apple.com/?q=Fox%20Theatre%2C%20Atlanta&ll=33.77,-84.39');
    expect(mapsUrl(place, { os: 'ios', directions: true })).toBe('http://maps.apple.com/?daddr=33.77,-84.39');
  });
  it('uses geo/navigation intents on Android and Google Maps on the web', () => {
    expect(mapsUrl({ parts: ['Fox Theatre'] }, { os: 'android' })).toBe('geo:0,0?q=Fox%20Theatre');
    expect(mapsUrl({ parts: ['Fox Theatre'] }, { os: 'android', directions: true })).toBe('google.navigation:q=Fox%20Theatre');
    expect(mapsUrl(place, { os: 'web', directions: true })).toBe('https://www.google.com/maps/dir/?api=1&destination=33.77,-84.39');
  });
});

describe('prayer reminders', () => {
  it('starts today when 9am is over an hour away, otherwise tomorrow, one per day', () => {
    expect(dailyReminderTimes(2, 9, new Date(2026, 10, 3, 7, 30)).map(d => [d.getDate(), d.getHours()])).toEqual([[3, 9], [4, 9]]);
    expect(dailyReminderTimes(1, 9, new Date(2026, 10, 3, 8, 30))[0].getDate()).toBe(4);
  });
  it('keeps 9am local across the clock change', () => {
    const times = dailyReminderTimes(3, 9, new Date(2026, 9, 31, 12));
    expect(times.map(d => [d.getDate(), d.getHours()])).toEqual([[1, 9], [2, 9], [3, 9]]);
  });
  it('names the author by first name unless anonymous, and trims long text', () => {
    expect(prayerReminderContent({ body: 'Job interview', author_name: 'Daniel Okafor' }).title).toBe('Pray for Daniel today');
    expect(prayerReminderContent({ body: 'x', author_name: 'Daniel', is_anonymous: true }).title).toBe('A prayer to carry today');
    expect(prayerReminderContent({ body: 'a'.repeat(200) }).body).toHaveLength(118);
  });
});
