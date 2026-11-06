import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { registerForPushNotifications, sendTestPush } from '../../lib/notifications';
import { haptic } from '../../lib/haptics';
import { AppText, Button, Card } from '../ui';
import { errorMessage } from '../host/errors';

interface PushResult {
  ok: boolean;
  text: string;
}

export function ToolsPanel() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<PushResult | null>(null);

  const sendTest = async () => {
    setBusy(true);
    setResult(null);
    try {
      const expoToken = await registerForPushNotifications(true);
      setToken(expoToken);
      if (!expoToken) {
        setResult({
          ok: false,
          text: 'No push token. Either notifications are off for this app, or the build has no EAS projectId (set extra.eas.projectId in app.json via `eas init`). Push also needs a physical device and a development or production build — not Expo Go.',
        });
        return;
      }
      const { ok, status, body } = await sendTestPush(expoToken);
      if (ok) haptic.success();
      else haptic.error();
      setResult({ ok, text: `HTTP ${status}\n${body.slice(0, 600)}` });
    } catch (err) {
      haptic.error();
      setResult({ ok: false, text: errorMessage(err, 'Request failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}>
      <Card style={{ gap: t.space.sm }}>
        <AppText variant="headline">Push notifications</AppText>
        <AppText variant="callout" tone="muted">
          Registers this device with Expo and sends a test notification to it.
        </AppText>
        <Button title="Send test push to this device" icon="notifications-outline" onPress={sendTest} loading={busy} />
        {token ? (
          <AppText variant="caption" tone="faint" selectable numberOfLines={2}>
            {token}
          </AppText>
        ) : null}
        {result ? (
          <View style={[s.result, { borderColor: result.ok ? t.c.success : t.c.danger, backgroundColor: result.ok ? t.c.successDim : t.c.dangerDim }]}>
            <AppText variant="bodyStrong" tone={result.ok ? 'success' : 'danger'}>
              {result.ok ? 'Sent — check your notifications' : 'Not sent'}
            </AppText>
            <AppText variant="caption" tone="muted" selectable style={{ fontFamily: t.fonts.regular }}>
              {result.text}
            </AppText>
          </View>
        ) : null}
      </Card>
      <Card style={{ gap: t.space.sm }}>
        <AppText variant="headline">Design system</AppText>
        <AppText variant="callout" tone="muted">
          Every component in light and dark.
        </AppText>
        <Button title="Open style guide" variant="secondary" icon="color-palette-outline" onPress={() => router.push('/styleguide')} />
      </Card>
    </ScrollView>
  );
}

const useStyles = makeStyles(t => ({
  result: { borderWidth: 1, borderRadius: t.radius.md, padding: t.space.sm, gap: 4 },
}));
