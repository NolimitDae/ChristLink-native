import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme, useThemeContext } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getChurch, updateSettings } from '../../lib/features';
import { SUPPORT_EMAIL } from '../../lib/constants';
import type { ThemePreference } from '../../lib/theme';
import type { UserSettings } from '../../lib/types';
import { AppText, ListGroup, ListRow, Screen, Segmented } from '../../components/ui';
import { BlockedSheet } from '../../components/settings/BlockedSheet';
import { DELETE_EXPLANATION, DeleteAccountSheet } from '../../components/settings/DeleteAccountSheet';
import { useSettingsStatus } from '../../components/settings/useSettingsStatus';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SOON = 'Available soon';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeContext();
  const { session, isAdmin, signOut } = useAuth();
  const { settings, setSettings, blockedIds } = useAppData();
  const { showToast } = useToast();
  const { status } = useSettingsStatus();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [churchName, setChurchName] = useState<string | null>(null);
  const unavailable = status === 'unavailable';
  const signedIn = !!session;

  useEffect(() => {
    const id = settings?.home_church_id;
    if (!id) {
      setChurchName(null);
      return;
    }
    getChurch(id)
      .then(c => setChurchName(c?.name ?? null))
      .catch(() => setChurchName(null));
  }, [settings?.home_church_id]);

  const patchSettings = async (patch: Partial<Omit<UserSettings, 'user_id'>>) => {
    const before = settings;
    if (settings) setSettings({ ...settings, ...patch });
    try {
      setSettings(await updateSettings(patch));
    } catch (err) {
      setSettings(before);
      showToast(err instanceof Error ? err.message : 'Could not save setting', 'error');
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can keep browsing events as a guest.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(tabs)');
          showToast('Signed out', 'info');
        },
      },
    ]);
  };

  const startDelete = () => {
    Alert.alert('Delete your account?', DELETE_EXPLANATION, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => setDeleteOpen(true) },
    ]);
  };

  const emailSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Christ Link Social support')}`).catch(() =>
      showToast(`Email us at ${SUPPORT_EMAIL}`, 'info'),
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen back title="Settings">
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: 48 }}>
        <ListGroup title="Appearance">
          <View style={{ paddingVertical: t.space.sm }}>
            <Segmented options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          </View>
        </ListGroup>

        {signedIn ? (
          <>
            <ListGroup title="Notifications">
              <ListRow icon="notifications-outline" title="Notifications" subtitle="Reminders, tickets, prayers and quiet hours" onPress={() => router.push('/settings/notifications')} last />
            </ListGroup>

            <ListGroup title="Privacy">
              <ListRow
                icon="eye-off-outline"
                title="Hide my RSVPs from people who aren't friends"
                subtitle={unavailable ? SOON : 'Only mutual follows see which events you attend'}
                toggle={!!settings?.hide_rsvps_from_non_friends}
                onToggle={v => patchSettings({ hide_rsvps_from_non_friends: v })}
                disabled={unavailable || status === 'loading'}
              />
              <ListRow
                icon="ban-outline"
                title="Blocked accounts"
                subtitle={unavailable ? SOON : undefined}
                value={unavailable ? undefined : String(blockedIds.size)}
                onPress={() => setBlockedOpen(true)}
                disabled={unavailable}
              />
              <ListRow
                icon="church-outline"
                title="Home Church"
                subtitle={unavailable ? SOON : churchName ?? (settings?.home_church_id ? 'Your church' : 'Not chosen yet')}
                onPress={() => router.push(settings?.home_church_id ? `/church/${settings.home_church_id}` : '/explore?tab=churches')}
                disabled={unavailable}
                last
              />
            </ListGroup>

            <ListGroup title="Hosting">
              <ListRow icon="wallet-outline" title="Payouts" subtitle="Connect Stripe to get paid for tickets" onPress={() => router.push('/host/payouts')} />
              <ListRow icon="shield-checkmark-outline" title="ID verification" subtitle="Required before selling tickets" onPress={() => router.push('/host/verify')} last />
            </ListGroup>
          </>
        ) : (
          <ListGroup title="Account">
            <ListRow icon="log-in-outline" title="Sign in" subtitle="Save events, RSVP and join the community" onPress={() => router.push('/auth')} last />
          </ListGroup>
        )}

        <ListGroup title="Support">
          <ListRow icon="mail-outline" title="Email support" subtitle={SUPPORT_EMAIL} onPress={emailSupport} />
          <ListRow icon="people-outline" title="Community guidelines" onPress={() => router.push('/legal/guidelines')} />
          <ListRow icon="lock-closed-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
          <ListRow icon="document-text-outline" title="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <ListRow icon="briefcase-outline" title="Host Agreement" onPress={() => router.push('/legal/host')} last />
        </ListGroup>

        {isAdmin ? (
          <ListGroup title="Admin">
            <ListRow icon="construct-outline" title="Admin tools" subtitle="Reports, verifications, church claims" onPress={() => router.push('/admin')} last />
          </ListGroup>
        ) : null}

        {signedIn ? (
          <ListGroup title="Account">
            <ListRow icon="log-out-outline" title="Sign out" onPress={confirmSignOut} />
            <ListRow icon="trash-outline" title="Delete account" subtitle="Permanently remove your data" destructive onPress={startDelete} last />
          </ListGroup>
        ) : null}

        <AppText variant="caption" tone="faint" align="center" style={{ marginTop: t.space.xs }}>
          Christ Link Social · Version {version}
        </AppText>
      </ScrollView>

      <BlockedSheet visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </Screen>
  );
}
