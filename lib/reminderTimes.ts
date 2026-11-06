/** Daily reminder times at `hour`:00 local, starting with the next one at least an hour away. */
export function dailyReminderTimes(count: number, hour = 9, now = new Date()): Date[] {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (first.getTime() < now.getTime() + 3_600_000) first.setDate(first.getDate() + 1);
  return Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, hour));
}

export const prayerReminderKey = (prayerId: string) => `prayer:${prayerId}`;

/** Notification text for a prayer reminder; keeps anonymous requests anonymous. */
export function prayerReminderContent(prayer: { body: string; author_name?: string | null; is_anonymous?: boolean }): {
  title: string;
  body: string;
} {
  const who = !prayer.is_anonymous && prayer.author_name ? prayer.author_name.trim().split(/\s+/)[0] : null;
  const text = prayer.body.replace(/\s+/g, ' ').trim();
  return {
    title: who ? `Pray for ${who} today` : 'A prayer to carry today',
    body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
  };
}
