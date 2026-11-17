import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { dismissBootShell } from '../lib/bootShell';
import { storage } from '../lib/storage';
import { Logo } from '../components/brand/Logo';
import { AppIcon } from '../components/icons/AppIcon';
import { TAGLINE, WELCOME_POINTS } from '../components/home/GuestHero';
import { AppText, Button } from '../components/ui';

/**
 * The website's first page for a new visitor: what Christ Link Social is, then on to the rest. app/_layout.tsx sends
 * a signed-out visitor here the first time they open christlinksocial.com (links to an event, church or other page
 * still open that page). Either button marks it seen, so it shows once per browser. The phone apps use the fuller
 * app/onboarding.tsx instead.
 */
export default function WelcomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    dismissBootShell();
  }, []);

  const go = async (signIn: boolean) => {
    if (leaving) return;
    setLeaving(true);
    await storage.setOnboardingDone(true);
    // Discover sits underneath, so closing the sign-in sheet lands there
    router.replace('/(tabs)');
    if (signIn) router.push('/auth');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: insets.top + t.space.xl,
        paddingBottom: insets.bottom + t.space.xl,
        paddingHorizontal: t.space.lg,
      }}
    >
      <View style={{ width: '100%', maxWidth: 460, gap: t.space.xl }}>
        <View style={{ alignItems: 'center', gap: t.space.lg }}>
          <Logo layout="stacked" width={190} />
          <View style={{ gap: t.space.sm }}>
            <AppText variant="display" align="center" accessibilityRole="header">
              {TAGLINE}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Christ Link Social is where Christians find gatherings near them, show up together and stay connected through the week.
            </AppText>
          </View>
        </View>

        <View style={{ gap: t.space.md }}>
          {WELCOME_POINTS.map(p => (
            <View key={p.icon} style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' }}>
              <View style={{ width: 26, alignItems: 'center', paddingTop: 1 }}>
                <AppIcon name={p.icon} size={22} color={t.c.goldText} />
              </View>
              <AppText variant="body" style={{ flex: 1 }}>
                {p.text}
              </AppText>
            </View>
          ))}
        </View>

        <View style={{ gap: t.space.sm }}>
          {session ? (
            <Button title="Go to Discover" size="lg" fullWidth onPress={() => go(false)} loading={leaving} />
          ) : (
            <>
              <Button title="Join free" size="lg" fullWidth onPress={() => go(true)} disabled={leaving} />
              <Button title="Look around first" variant="secondary" size="lg" fullWidth onPress={() => go(false)} disabled={leaving} />
            </>
          )}
          <AppText variant="caption" tone="muted" align="center" style={{ marginTop: t.space.xs }}>
            Free to join. No ads. Sign in with just your email.
          </AppText>
        </View>
      </View>
    </ScrollView>
  );
}
