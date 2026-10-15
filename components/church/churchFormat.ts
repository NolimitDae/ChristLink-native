import { nextOccurrences, WEEKDAYS, type RecurringRule } from '../../lib/recurrence';
import { FeatureError } from '../../lib/features';
import type { Church, ChurchRecurringEvent } from '../../lib/types';

const DAY_MS = 86_400_000;

export interface ScheduleItem {
  key: string;
  date: Date;
  title: string;
  isService: boolean;
  location?: string | null;
}

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function shortDay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function serviceTimeRule(st: { day: number; time: string }): RecurringRule {
  return { frequency: 'weekly', weekday: st.day, start_time: st.time, starts_on: '2000-01-02' };
}

export function serviceTimeLabel(st: { day: number; time: string; label?: string }): string {
  const day = (WEEKDAYS[st.day] ?? 'Sunday').slice(0, 3);
  return `${day} ${formatClock(st.time)}${st.label ? ` · ${st.label}` : ''}`;
}

/** Everything happening at a church in the next `days` days: fixed service times plus recurring gatherings. */
export function upcomingSchedule(
  church: Pick<Church, 'service_times'>,
  recurring: ChurchRecurringEvent[],
  days = 7,
  now = new Date(),
): ScheduleItem[] {
  const end = now.getTime() + days * DAY_MS;
  const items: ScheduleItem[] = [];
  (church.service_times ?? []).forEach((st, i) => {
    const [d] = nextOccurrences(serviceTimeRule(st), now, 1);
    if (d && d.getTime() <= end) items.push({ key: `st-${i}`, date: d, title: st.label || 'Service', isService: true });
  });
  recurring.forEach(r => {
    nextOccurrences(r, now, 2)
      .filter(d => d.getTime() <= end)
      .forEach((d, j) => items.push({ key: `${r.id}-${j}`, date: d, title: r.name, isService: r.is_service, location: r.location }));
  });
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function isNotSetUp(err: unknown): boolean {
  return err instanceof FeatureError && err.notSetUp;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function churchPlace(church: Pick<Church, 'city' | 'state'>): string {
  return [church.city, church.state].filter(Boolean).join(', ');
}

export function todayYmd(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
