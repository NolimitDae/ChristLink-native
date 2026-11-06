import { Linking, Platform } from 'react-native';
import { logger } from './logger';

export interface CalendarEntry {
  title: string;
  start: string;
  end?: string | null;
  location?: string | null;
  notes?: string | null;
  url?: string | null;
}

/** Events without an end time get this length in calendars. */
const DEFAULT_LENGTH_MS = 2 * 3_600_000;

export function entryEnd(entry: Pick<CalendarEntry, 'start' | 'end'>): Date {
  const start = new Date(entry.start);
  const end = entry.end ? new Date(entry.end) : null;
  return end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + DEFAULT_LENGTH_MS);
}

function gcalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Google Calendar "add event" link: the fallback when the native calendar sheet isn't in this build. */
export function googleCalendarUrl(entry: CalendarEntry): string {
  const details = [entry.notes, entry.url].filter(Boolean).join('\n\n');
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', entry.title],
    ['dates', `${gcalStamp(new Date(entry.start))}/${gcalStamp(entryEnd(entry))}`],
  ];
  if (details) params.push(['details', details]);
  if (entry.location) params.push(['location', entry.location]);
  return `https://calendar.google.com/calendar/render?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

interface NativeCalendar {
  createEventInCalendarAsync: (
    data: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string; url?: string },
  ) => Promise<{ action: string }>;
}

/** Loaded lazily: builds made before expo-calendar was added don't have the native module, and import would throw. */
function nativeCalendar(): NativeCalendar | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-calendar/legacy') as NativeCalendar;
  } catch (err) {
    logger.info('Native calendar unavailable', { error: String(err) });
    return null;
  }
}

/**
 * Opens the system "new event" sheet prefilled (no calendar permission needed), or Google Calendar as a fallback.
 * Resolves 'saved' only when the person confirmed the event (iOS reports it; Android doesn't).
 */
export async function addToCalendar(entry: CalendarEntry): Promise<'saved' | 'canceled' | 'opened'> {
  const native = nativeCalendar();
  if (native) {
    try {
      const res = await native.createEventInCalendarAsync({
        title: entry.title,
        startDate: new Date(entry.start),
        endDate: entryEnd(entry),
        location: entry.location ?? undefined,
        notes: entry.notes ?? undefined,
        url: entry.url ?? undefined,
      });
      return res.action === 'saved' ? 'saved' : res.action === 'canceled' ? 'canceled' : 'opened';
    } catch (err) {
      logger.info('Calendar sheet failed; using Google Calendar', { error: String(err) });
    }
  }
  await Linking.openURL(googleCalendarUrl(entry));
  return 'opened';
}
