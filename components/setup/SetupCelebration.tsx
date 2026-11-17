import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { firstName } from '../../lib/format';
import { SPRING } from '../../lib/motion';
import { AppText, Button, LightBurst } from '../ui';

const PIECES = 36;
const FALL_MS = 2400;
/** Height of the box the check badge sits in. */
const BADGE_BOX = 150;

/** Stable pseudo-random numbers, so the burst looks the same on every render of one celebration. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

/**
 * Confetti bursting out of the check badge (origin = top-left of this layer, centred horizontally by `originX`),
 * thrown up and out, then falling past the card and fading. Reduce Motion: not shown.
 */
function Confetti({ play, originX, originY }: { play: boolean; originX: number; originY: number }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const colors = [t.c.gold, t.c.goldText, t.c.success, t.c.text, t.c.goldHairline, t.c.danger];

  const pieces = useMemo(() => {
    const rnd = seeded(7);
    return Array.from({ length: PIECES }, (_, i) => {
      const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.15; // mostly upward, fanned out
      const speed = 0.35 + rnd() * 0.45;
      return {
        key: i,
        dx: Math.cos(angle) * speed * width * 0.8,
        dy: Math.sin(angle) * speed * height * 0.42,
        fall: height * (0.6 + rnd() * 0.35),
        spin: (rnd() > 0.5 ? 1 : -1) * (360 + rnd() * 540),
        w: 6 + rnd() * 6,
        h: rnd() > 0.5 ? 6 + rnd() * 4 : 12 + rnd() * 6,
        round: rnd() > 0.7,
        color: colors[i % colors.length],
        delay: rnd() * 0.12,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, t.scheme]);

  useEffect(() => {
    if (!play) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: FALL_MS, easing: Easing.linear, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [play, progress]);

  if (!play) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'visible' }]} importantForAccessibility="no-hide-descendants">
      {pieces.map(p => {
        const local = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        // Up and out fast, then gravity: y = dy·(2u − u²) + fall·u²
        const translateX = local.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, p.dx * 0.8, p.dx] });
        const translateY = local.interpolate({
          inputRange: [0, 0.15, 0.3, 0.5, 0.75, 1],
          outputRange: [0, p.dy * 0.6, p.dy * 0.9, p.dy * 0.75 + p.fall * 0.25, p.dy * 0.45 + p.fall * 0.55, p.fall],
        });
        const rotate = local.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
        const opacity = local.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute',
              left: originX - p.w / 2,
              top: originY - p.h / 2,
              width: p.w,
              height: p.h,
              borderRadius: p.round ? p.w / 2 : 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * The thank-you when the last setup step is done: a gold burst, confetti and a check that pops in, then a short
 * thank-you and one button. Shown once per account (the server hands out the celebration once).
 */
export function SetupCelebration({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { profile } = useAuth();
  const name = firstName(profile?.full_name);
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const [cardWidth, setCardWidth] = useState(0);

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    rise.setValue(0);
    if (t.reduceMotion) {
      Animated.timing(rise, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      pop.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, ...SPRING.pop, useNativeDriver: true }),
        Animated.spring(rise, { toValue: 1, ...SPRING.sheet, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, pop, rise, t.reduceMotion]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: t.c.overlay }]}>
        <Animated.View
          accessibilityViewIsModal
          onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
          style={[
            styles.card,
            {
              backgroundColor: t.c.surface,
              borderRadius: t.radius.xl,
              padding: t.space.lg,
              gap: t.space.sm,
              opacity: rise,
              transform: t.reduceMotion ? [] : [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <View style={styles.badgeWrap}>
            <LightBurst play={visible ? 1 : 0} size={170} />
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: t.c.gold, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] },
              ]}
            >
              <Ionicons name="checkmark" size={46} color={t.c.onGold} />
            </Animated.View>
          </View>
          <AppText variant="title1" align="center" accessibilityRole="header">
            {name ? `You’re all set, ${name}!` : 'You’re all set!'}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            Thank you for making Christ Link Social home. Your profile is ready, so friends and your church can find you.
            We’re so glad you’re here.
          </AppText>
          <Button title="Start exploring" size="lg" onPress={onClose} fullWidth style={{ marginTop: t.space.sm }} />
          {/* In front of the card, bursting from the badge's centre */}
          <Confetti play={visible && !t.reduceMotion && cardWidth > 0} originX={cardWidth / 2} originY={t.space.lg + BADGE_BOX / 2} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, alignItems: 'stretch', overflow: 'visible' },
  badgeWrap: { height: BADGE_BOX, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
