import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { updateSettings } from '../../lib/features';
import { notificationPermissionStatus, registerForPushNotifications, requestNotificationPermissions } from '../../lib/notifications';
import type { NotificationType, UserSettings } from '../../lib/types';
import { AppText, Button, Card, EmptyState, ListGroup, ListRow, Screen } from '../../components/ui';
import { HourPicker, formatHour } from '../../components/settings/HourPicker';
import { useSettingsStatus } from '../../components/settings/useSettingsStatus';

const TYPES: { key: NotificationType; label: string }[] = [
  { key: 'tickets', label: 'Ticket & RSVP confirmations' },
  { key: 'reminders', label: 'Event reminders (24h and 1h before)' },
  { key: 'new_events', label: 'New events from churches and hosts you follow' },
  { key: 'friend_rsvps', label: 'When friends RSVP nearby (max once a day)' },
  { key: 'prayer', label: 'Prayer updates' },
  { key: 'serve', label: 'Serve shift reminders' },
  { key: 'forum', label: 'Forum replies' },
  { key: 'refunds', label: 'Refund updates' },
  { key: 'host', label: 'Hosting & verification updates' },
];

const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 7;

type Permission = 'granted' | 'denied' | 'undetermined' | null;

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export default function NotificationSettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { settings, setSettings } = useAppData();
  const { showToast } = useToast();
  const { status } = useSettingsStatus();
  const [permission, setPermission] = useState<Permission>(null);
  const [asking, setAsking] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const unavailable = status === 'unavailable';
  const disabled = unavailable || status === 'loading';

  const checkPermission = useCallback(() => {
    notificationPermissionStatus()
      .then(setPermission)
      .catch(() => setPermission('undetermined'));
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  const turnOn = async () => {
    if (permission === 'denied') {
      Linking.openSettings().catch(() => undefined);
      return;
    }
    setAsking(true);
    try {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await registerForPushNotifications(true);
        showToast('Notifications are on', 'success');
      }
      checkPermission();
    } finally {
      setAsking(false);
    }
  };

  const patch = async (p: Partial<Omit<UserSettings, 'user_id'>>) => {
    const before = settings;
    if (settings) setSettings({ ...settings, ...p });
    try {
      setSettings(await updateSettings(p));
    } catch (err) {
      setSettings(before);
      showToast(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  };

  if (!session) {
    return (
      <Screen back title="Notifications">
        <EmptyState art="bell" title="Sign in to manage notifications" body="Choose which reminders and updates you receive." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  const prefs = settings?.notification_prefs ?? {};
  const quietOn = settings?.quiet_hours_start !== null && settings?.quiet_hours_start !== undefined;
  const quietStart = settings?.quiet_hours_start ?? DEFAULT_QUIET_START;
  const quietEnd = settings?.quiet_hours_end ?? DEFAULT_QUIET_END;
  const subtitle = unavailable ? 'Available soon' : undefined;

  return (
    <Screen back title="Notifications">
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: 48 }}>
        {permission && permission !== 'granted' ? (
          <Card variant="featured" style={{ marginBottom: t.space.lg, gap: t.space.sm }}>
            <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'center' }}>
              <Ionicons name="notifications-off-outline" size={22} color={t.c.goldText} />
              <AppText variant="headline" style={{ flex: 1 }}>
                Notifications are off
              </AppText>
            </View>
            <AppText variant="callout" tone="muted">
              {permission === 'denied'
                ? 'You turned notifications off for Christ Link Social. Open your phone settings to get ticket confirmations and event reminders.'
                : 'Turn them on to get ticket confirmations, a reminder before events you’re going to, and updates when someone prays for you.'}
            </AppText>
            <Button title={permission === 'denied' ? 'Open settings' : 'Turn on'} icon="notifications-outline" onPress={turnOn} loading={asking} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : null}

        <ListGroup title="Send me">
          {TYPES.map((tp, i) => (
            <ListRow
              key={tp.key}
              title={tp.label}
              subtitle={subtitle}
              toggle={prefs[tp.key] !== false}
              onToggle={v => patch({ notification_prefs: { ...prefs, [tp.key]: v } })}
              disabled={disabled}
              last={i === TYPES.length - 1}
            />
          ))}
        </ListGroup>

        <ListGroup title="Quiet hours">
          <ListRow
            icon="moon-outline"
            title="Pause notifications overnight"
            subtitle={subtitle ?? 'Reminders wait until quiet hours end'}
            toggle={quietOn}
            onToggle={v =>
              patch(
                v
                  ? { quiet_hours_start: quietStart, quiet_hours_end: quietEnd, timezone: deviceTimezone() }
                  : { quiet_hours_start: null, quiet_hours_end: null },
              )
            }
            disabled={disabled}
            last={!quietOn}
          />
          {quietOn ? (
            <>
              <ListRow title="Starts" value={formatHour(quietStart)} onPress={() => setPicker('start')} disabled={disabled} />
              <ListRow title="Ends" value={formatHour(quietEnd)} onPress={() => setPicker('end')} disabled={disabled} last />
            </>
          ) : null}
        </ListGroup>
        {quietOn && settings?.timezone ? (
          <AppText variant="caption" tone="faint" style={{ marginTop: -t.space.sm, marginLeft: 4 }}>
            Time zone: {settings.timezone}
          </AppText>
        ) : null}
      </ScrollView>

      <HourPicker
        visible={picker !== null}
        title={picker === 'start' ? 'Quiet hours start' : 'Quiet hours end'}
        hour={picker === 'end' ? quietEnd : quietStart}
        onClose={() => setPicker(null)}
        onPick={h => patch(picker === 'end' ? { quiet_hours_end: h, timezone: deviceTimezone() } : { quiet_hours_start: h, timezone: deviceTimezone() })}
      />
    </Screen>
  );
}
