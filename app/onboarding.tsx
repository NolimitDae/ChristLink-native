import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateSettings } from '../lib/features';
import { haptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { registerForPushNotifications, requestNotificationPermissions } from '../lib/notifications';
import { storage } from '../lib/storage';
import type { Church } from '../lib/types';
import { AppText, Button } from '../components/ui';
import { ChurchStep } from '../components/onboarding/ChurchStep';
import { LoopStep, WelcomeStep } from '../components/onboarding/Steps';
import { setPendingHomeChurch } from '../components/onboarding/pendingChurch';

const STEPS = 3;

export default function OnboardingScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { settings, setSettings } = useAppData();
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [asking, setAsking] = useState<'notifications' | 'location' | null>(null);
  const [finishing, setFinishing] = useState(false);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(STEPS - 1, i));
    pager.current?.scrollTo({ x: next * width, animated: !t.reduceMotion });
    setIndex(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const selectChurch = async (church: Church | null) => {
    haptic.tap();
    const id = church?.id ?? null;
    setChurchId(id);
    if (session) {
      try {
        setSettings(await updateSettings({ home_church_id: id }));
      } catch (err) {
        logger.warn('Home church not saved', { error: String(err) });
      }
    } else {
      await setPendingHomeChurch(id);
    }
  };

  const allowNotifications = async () => {
    setAsking('notifications');
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsOn(granted);
      if (granted) {
        haptic.success();
        if (session) registerForPushNotifications(false);
      }
    } finally {
      setAsking(null);
    }
  };

  const allowLocation = async () => {
    setAsking('location');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationOn(status === 'granted');
      if (status === 'granted') haptic.success();
    } catch (err) {
      logger.warn('Location permission failed', { error: String(err) });
    } finally {
      setAsking(null);
    }
  };

  const finish = async () => {
    setFinishing(true);
    await storage.setOnboardingDone(true);
    if (session && settings) {
      try {
        setSettings(await updateSettings({ onboarding_completed_at: new Date().toISOString() }));
      } catch (err) {
        logger.warn('Onboarding completion not saved', { error: String(err) });
      }
    }
    router.replace('/(tabs)');
  };

  const last = index === STEPS - 1;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + t.space.md }]}>
      <View style={styles.top}>
        <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding" style={styles.skip}>
          <AppText variant="callout" tone="muted">
            Skip
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View style={[styles.page, { width, paddingHorizontal: t.space.lg }]} accessibilityElementsHidden={index !== 0}>
          <WelcomeStep />
        </View>
        <View style={[styles.page, { width, paddingHorizontal: t.space.lg, paddingTop: t.space.md }]} accessibilityElementsHidden={index !== 1}>
          <ChurchStep selectedId={churchId} onSelect={selectChurch} />
        </View>
        <View style={[styles.page, { width, paddingHorizontal: t.space.lg }]} accessibilityElementsHidden={index !== 2}>
          <LoopStep
            notificationsOn={notificationsOn}
            locationOn={locationOn}
            onAllowNotifications={allowNotifications}
            onAllowLocation={allowLocation}
            busy={asking}
          />
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingHorizontal: t.space.lg, gap: t.space.md }]}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={`Step ${index + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? t.c.gold : t.c.borderStrong,
              }}
            />
          ))}
        </View>
        <Button
          title={last ? 'Get started' : index === 1 && !churchId ? 'Not now' : 'Next'}
          variant={index === 1 && !churchId ? 'secondary' : 'primary'}
          size="lg"
          iconRight={last ? undefined : 'arrow-forward'}
          onPress={() => (last ? finish() : goTo(index + 1))}
          loading={finishing}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, minHeight: 44 },
  skip: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1 },
  bottom: { paddingTop: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
