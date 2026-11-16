import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Logo } from '../brand/Logo';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { AppText, Button } from '../ui';

const POINTS: { icon: AppIconName; text: string }[] = [
  { icon: 'calendar-outline', text: 'Find worship nights, Bible studies and retreats near you, and see who’s going' },
  { icon: 'pray-outline', text: 'Share prayer requests and pray for others in your community' },
  { icon: 'church-outline', text: 'Find a church to call home: service times, gatherings and a first-visit hello' },
];

/**
 * Top of Discover for people who aren't signed in: what Christ Link Social is and the two things to do next.
 * Replaces the "Welcome / today's date" header, which told a first-time visitor nothing.
 */
export function GuestHero() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: t.space.md, gap: t.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo width={168} />
        <Button title="Sign in" variant="ghost" size="sm" onPress={() => router.push('/auth')} />
      </View>
      <View style={{ gap: t.space.xs }}>
        <AppText variant="display" accessibilityRole="header">
          Faith events and community, in person.
        </AppText>
        <AppText variant="body" tone="muted">
          Christ Link Social is where Christians find gatherings near them, show up together and stay connected through the week.
        </AppText>
      </View>
      <View style={{ gap: t.space.sm }}>
        {POINTS.map(p => (
          <View key={p.icon} style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' }}>
            <View style={{ width: 24, alignItems: 'center', paddingTop: 2 }}>
              <AppIcon name={p.icon} size={20} color={t.c.goldText} />
            </View>
            <AppText variant="callout" style={{ flex: 1 }}>
              {p.text}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        <Button title="Join free" size="lg" onPress={() => router.push('/auth')} style={{ flexGrow: 1 }} />
        <Button title="Browse events" variant="secondary" size="lg" onPress={() => router.push('/explore?tab=events')} style={{ flexGrow: 1 }} />
      </View>
      <AppText variant="caption" tone="muted">
        Free to join. No ads. Sign in with just your email.
      </AppText>
    </View>
  );
}
