const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatDateLong(iso?: string | null): string {
  if (!iso) return 'Date to be announced';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start) return '';
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function dateBlockParts(iso?: string | null): { month: string; day: string; weekday: string } {
  if (!iso) return { month: 'TBA', day: '–', weekday: '' };
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export type EventTiming =
  | { kind: 'live' }
  | { kind: 'startsIn'; label: string }
  | { kind: 'upcoming' }
  | { kind: 'past' }
  | { kind: 'tba' };

/** Badge state for an event: LIVE while running, "Starts in 2h 10m" within 24h. */
export function eventTiming(start?: string | null, end?: string | null, now = Date.now()): EventTiming {
  if (!start) return { kind: 'tba' };
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : s + 2 * HOUR;
  if (now >= s && now <= e) return { kind: 'live' };
  if (now > e) return { kind: 'past' };
  const diff = s - now;
  if (diff <= DAY) return { kind: 'startsIn', label: countdownLabel(diff) };
  return { kind: 'upcoming' };
}

export function countdownLabel(ms: number): string {
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function isTonight(iso?: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay && d.getHours() >= 16 && d.getTime() > now.getTime() - 2 * HOUR;
}

export function isWithinDays(iso: string | null | undefined, days: number, now = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= now.getTime() - 2 * HOUR && t <= now.getTime() + days * DAY;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName?: string | null): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Sarah + 4 friends going" / "Sarah and Ben going" / "128 going". */
export function friendsGoingLabel(friendNames: string[], friendCount: number, attendeeCount: number): string {
  if (friendCount <= 0 || friendNames.length === 0) {
    return attendeeCount > 0 ? `${attendeeCount} going` : 'Be the first to go';
  }
  const first = firstName(friendNames[0]) || 'A friend';
  if (friendCount === 1) return `${first} is going`;
  if (friendCount === 2 && friendNames[1]) return `${first} and ${firstName(friendNames[1])} going`;
  return `${first} + ${friendCount - 1} friends going`;
}

export function eventFormatLabel(format?: string | null): string {
  if (format === 'online') return 'Online';
  if (format === 'hybrid') return 'Hybrid';
  return 'In person';
}

export function weekDays(now = new Date()): Date[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
}

export function sameDay(a: Date, iso?: string | null): boolean {
  return !!iso && new Date(iso).toDateString() === a.toDateString();
}
