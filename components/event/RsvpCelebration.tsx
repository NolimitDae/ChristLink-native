import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { formatDateShort, formatTime } from '../../lib/format';
import { shadow } from '../../lib/theme';
import { AppText } from '../ui/AppText';
import { LightBurst } from '../ui/LightBurst';

interface RsvpCelebrationProps {
  /** Increment to play. */
  play: number;
  title: string;
  subtitle?: string;
  eventName: string;
  start?: string;
  onDone?: () => void;
}

const CARD_W = 220;
const CARD_H = 132;
const TAB_COUNT = 5;
const TICKETS_TAB_INDEX = 4;

/**
 * Signature moment: a gold burst, then a small ticket that "lands" in the Tickets tab
 * (bottom-right of the floating tab bar) while shrinking and fading.
 */
export function RsvpCelebration({ play, title, subtitle = 'Saved to your Tickets', eventName, start, onDone }: RsvpCelebrationProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [burst, setBurst] = useState(0);
  const backdrop = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const land = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const barInner = width - 28;
  const tabX = 14 + (barInner / TAB_COUNT) * (TICKETS_TAB_INDEX + 0.5);
  const tabY = height - Math.max(insets.bottom, 10) - 32;
  const dx = tabX - width / 2;
  const dy = tabY - height / 2;

  useEffect(() => {
    if (!play) return;
    setVisible(true);
    setBurst(b => b + 1);
    haptic.success();
    AccessibilityInfo.announceForAccessibility(`${title}. ${subtitle}`);
    backdrop.setValue(0);
    land.setValue(0);
    let anim: Animated.CompositeAnimation;
    if (t.reduceMotion) {
      enter.setValue(1);
      anim = Animated.sequence([
        Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]);
    } else {
      enter.setValue(0);
      anim = Animated.sequence([
        Animated.parallel([
          Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(enter, { toValue: 1, damping: 11, stiffness: 160, mass: 0.8, useNativeDriver: true }),
        ]),
        Animated.delay(950),
        Animated.timing(land, { toValue: 1, duration: 680, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]);
    }
    anim.start(() => {
      setVisible(false);
      doneRef.current?.();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (!visible) return null;

  const enterClamped = enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const cardTransform = t.reduceMotion
    ? []
    : [
        { translateX: land.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
        { translateY: land.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -28, dy] }) },
        { rotate: land.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] }) },
        { scale: Animated.multiply(enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), land.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] })) },
      ];
  const cardOpacity = t.reduceMotion
    ? backdrop
    : Animated.multiply(enterClamped, land.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }));
  const textOpacity = t.reduceMotion
    ? backdrop
    : Animated.multiply(enterClamped, land.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.overlay, opacity: backdrop }]} />
      <LightBurst play={burst} size={280} />
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: t.c.bgElevated, borderColor: t.c.gold, opacity: cardOpacity, transform: cardTransform },
            shadow(3, t.c.shadow),
          ]}
        >
          <LinearGradient colors={[t.c.gold, t.c.goldPressed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.band}>
            <Ionicons name="ticket" size={14} color={t.c.onGold} />
            <AppText variant="overline" color={t.c.onGold} style={{ fontSize: 10 }}>
              Admit one
            </AppText>
          </LinearGradient>
          <View style={styles.cardBody}>
            <AppText variant="headline" numberOfLines={2} style={{ fontFamily: t.fonts.display, fontSize: 18, lineHeight: 22 }}>
              {eventName}
            </AppText>
            {start ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {formatDateShort(start)} · {formatTime(start)}
              </AppText>
            ) : null}
          </View>
          <View style={[styles.notch, styles.notchL, { backgroundColor: t.c.overlay }]} />
          <View style={[styles.notch, styles.notchR, { backgroundColor: t.c.overlay }]} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.textWrap, { top: height / 2 + CARD_H / 2 + 36, opacity: textOpacity }]} pointerEvents="none">
        <AppText variant="title1" align="center" color="#F6EFE3">
          {title}
        </AppText>
        <AppText variant="callout" align="center" color="#D9BC6A" style={{ marginTop: 6 }}>
          {subtitle}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100 },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { width: CARD_W, height: CARD_H, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  band: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  cardBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 4, justifyContent: 'center' },
  notch: { position: 'absolute', top: 34 - 9, width: 18, height: 18, borderRadius: 9 },
  notchL: { left: -9 },
  notchR: { right: -9 },
  textWrap: { position: 'absolute', left: 24, right: 24 },
});
