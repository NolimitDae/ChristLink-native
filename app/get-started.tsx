import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useGettingStarted } from '../contexts/GettingStartedContext';
import { useTheme } from '../contexts/ThemeContext';
import { firstName } from '../lib/format';
import { haptic } from '../lib/haptics';
import { Logo } from '../components/brand/Logo';
import { Appear, AppText, Button, LightBurst, LineArt } from '../components/ui';
import type { LineArtName } from '../components/ui/LineArt';

interface Slide {
  art: LineArtName | 'logo';
  title: (name: string | null) => string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    art: 'logo',
    title: name => (name ? `Welcome, ${name}` : 'Welcome'),
    body: 'Christ Link Social is where Christians find gatherings near them, show up together and stay connected through the week.',
  },
  {
    art: 'calendar',
    title: () => 'Find faith events near you',
    body: 'Worship nights, Bible studies, retreats and concerts. See which friends are going, then RSVP or get tickets in a tap.',
  },
  {
    art: 'prayer',
    title: () => 'Pray together',
    body: 'Share prayer requests, pray for others and hear when prayers are answered. Your community is with you all week.',
  },
  {
    art: 'church',
    title: () => 'Find a church home and serve',
    body: 'Service times, gatherings and volunteer shifts in one place, plus a friendly hello before your first visit.',
  },
  {
    art: 'people',
    title: () => 'Let’s set up your account',
    body: 'Seven quick steps: a photo, a cover, a short bio, your interests, your church, a first post and an event. They’re in Notifications whenever you want them.',
  },
];

/**
 * The welcome tour a new account sees once, right after its first sign-in (GettingStartedHost opens it). Ends on
 * the setup checklist in Notifications.
 */
export default function GetStartedScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { markWelcomed } = useGettingStarted();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const name = firstName(profile?.full_name);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  // Mark it seen as soon as it opens, so it never comes back, even if the app is closed mid-way
  useEffect(() => {
    markWelcomed();
  }, [markWelcomed]);

  const leave = (toChecklist: boolean) => {
    if (leaving) return;
    setLeaving(true);
    if (toChecklist) {
      haptic.success();
      router.replace('/notifications');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + t.space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: t.space.md, minHeight: 44 }}>
        {last ? null : (
          <Pressable
            onPress={() => leave(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText variant="callout" tone="muted">
              Skip
            </AppText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: t.space.lg }}>
        <Appear key={index} style={{ width: '100%', maxWidth: 460, alignSelf: 'center', alignItems: 'center', gap: t.space.lg }}>
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
            <LightBurst play={index + 1} size={200} />
            {slide.art === 'logo' ? (
              <Logo layout="stacked" width={180} />
            ) : (
              <View
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: t.c.goldDim,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LineArt name={slide.art} size={140} />
              </View>
            )}
          </View>
          <View style={{ gap: t.space.sm }}>
            <AppText variant="display" align="center" accessibilityRole="header">
              {slide.title(name)}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {slide.body}
            </AppText>
          </View>
        </Appear>
      </ScrollView>

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.md, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? t.c.gold : t.c.borderStrong }}
            />
          ))}
        </View>
        {last ? (
          <>
            <Button title="Start setup" size="lg" fullWidth onPress={() => leave(true)} loading={leaving} />
            <Button title="Later" variant="secondary" size="lg" fullWidth onPress={() => leave(false)} disabled={leaving} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            {index > 0 ? (
              <Button title="Back" variant="secondary" size="lg" onPress={() => setIndex(index - 1)} style={{ flex: 1 }} fullWidth />
            ) : null}
            <Button title="Next" size="lg" onPress={() => setIndex(index + 1)} style={{ flex: 1 }} fullWidth />
          </View>
        )}
      </View>
    </View>
  );
}
