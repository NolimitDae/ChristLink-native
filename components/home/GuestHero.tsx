import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Logo } from '../brand/Logo';
import type { AppIconName } from '../icons/AppIcon';
import { AppText, Button } from '../ui';

/** What Christ Link Social is, in one line and three points (the website's welcome page, app/welcome.tsx). */
export const TAGLINE = 'Faith events and community, in person.';
export const WELCOME_POINTS: { icon: AppIconName; text: string }[] = [
  { icon: 'calendar-outline', text: 'Find worship nights, Bible studies and retreats near you, and see who’s going' },
  { icon: 'pray-outline', text: 'Share prayer requests and pray for others in your community' },
  { icon: 'church-outline', text: 'Find a church to call home: service times, gatherings and a first-visit hello' },
];

/**
 * Top of Discover for people who aren't signed in: the name, the one-line promise and a way in. The full
 * introduction is its own page (app/welcome.tsx), shown the first time someone opens the website.
 */
export function GuestHeader() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: t.space.md, gap: t.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
        <Logo width={168} />
        <Button title="Join free" size="sm" onPress={() => router.push('/auth')} />
      </View>
      <AppText variant="callout" tone="muted">
        {TAGLINE}
      </AppText>
    </View>
  );
}
