import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from './logger';
import { savePushToken } from './features';
import { storage } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function notificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Christ Link Social',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#C9A84C',
  });
}

/**
 * Registers the device for remote push and stores the Expo push token in Supabase (push_tokens).
 * Only asks for permission when `prompt` is true, so the system dialog appears after we explain why.
 */
export async function registerForPushNotifications(prompt = false): Promise<string | null> {
  try {
    const granted = prompt ? await requestNotificationPermissions() : (await notificationPermissionStatus()) === 'granted';
    if (!granted) return null;
    await ensureAndroidChannel();

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId || !UUID.test(projectId)) {
      logger.info('Remote push disabled: set extra.eas.projectId in app.json (run `eas init`).');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    try {
      await savePushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    } catch (err) {
      logger.warn('Push token not saved', { error: String(err) });
    }
    return token;
  } catch (err) {
    logger.warn('Push registration failed', { error: String(err) });
    return null;
  }
}

/**
 * Local reminders scheduled on the device (24h and 1h before an event, 24h and 2h before a Serve shift).
 * These work without a push server and are cancelled when the RSVP or sign-up is cancelled.
 */
export async function scheduleReminders(
  key: string,
  title: string,
  startIso: string,
  offsetsHours: number[],
  data: Record<string, string>,
): Promise<void> {
  try {
    if ((await notificationPermissionStatus()) !== 'granted') return;
    await ensureAndroidChannel();
    await cancelReminders(key);
    const start = new Date(startIso).getTime();
    const ids: string[] = [];
    for (const h of offsetsHours) {
      const at = start - h * 3_600_000;
      if (at <= Date.now() + 60_000) continue;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: h >= 24 ? 'Tomorrow — see you there.' : `Starts in ${h === 1 ? 'one hour' : `${h} hours`}.`,
          data,
        },
        trigger: { date: new Date(at), channelId: 'default' } as Notifications.NotificationTriggerInput,
      });
      ids.push(id);
    }
    const map = await storage.getReminderMap();
    map[key] = ids;
    await storage.setReminderMap(map);
  } catch (err) {
    logger.warn('Could not schedule reminders', { error: String(err) });
  }
}

export async function cancelReminders(key: string): Promise<void> {
  const map = await storage.getReminderMap();
  const ids = map[key] ?? [];
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  if (ids.length) {
    delete map[key];
    await storage.setReminderMap(map);
  }
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/** Latest notification tap, including the one that cold-started the app (a listener misses that one). */
export const useLastNotificationResponse = Notifications.useLastNotificationResponse;

/** Admin tool: send a test push straight to this device through Expo's push service. */
export async function sendTestPush(expoToken: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: expoToken, title: 'Test from Christ Link Social', body: 'Push is working ✓', data: {} }),
  });
  const body = await res.text();
  return { ok: res.ok && !/"status"\s*:\s*"error"/.test(body), status: res.status, body };
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count).catch(() => undefined);
}

/** Route for a tapped notification's data payload. */
export function routeForNotification(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : null);
  if (str('ticketId')) return `/ticket/${str('ticketId')}`;
  if (str('eventId')) return `/event/${str('eventId')}`;
  if (str('prayerId')) return '/(tabs)/community?view=prayer';
  if (str('churchId')) return `/church/${str('churchId')}`;
  if (str('shiftId')) return '/serve';
  return '/notifications';
}
