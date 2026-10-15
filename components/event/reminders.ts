import {
  cancelReminders,
  notificationPermissionStatus,
  requestNotificationPermissions,
  scheduleReminders,
} from '../../lib/notifications';
import { logger } from '../../lib/logger';
import type { Event } from '../../lib/types';

const key = (eventId: string) => `event:${eventId}`;

/** Asks for permission only when undetermined (after a one-line explanation), then schedules 24h + 1h reminders. */
export async function setupEventReminders(event: Pick<Event, 'id' | 'name' | 'start_date'>, explain: (msg: string) => void): Promise<void> {
  if (!event.start_date) return;
  try {
    if ((await notificationPermissionStatus()) === 'undetermined') {
      explain('We’ll remind you a day and an hour before it starts.');
      await requestNotificationPermissions();
    }
    await scheduleReminders(key(event.id), event.name, event.start_date, [24, 1], { eventId: event.id });
  } catch (err) {
    logger.warn('Event reminders not set', { error: String(err) });
  }
}

export function clearEventReminders(eventId: string): Promise<void> {
  return cancelReminders(key(eventId)).catch(err => logger.warn('Cancel reminders failed', { error: String(err) }));
}
