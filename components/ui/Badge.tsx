import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { eventTiming } from '../../lib/format';
import { AppText } from './AppText';

type BadgeTone = 'gold' | 'free' | 'live' | 'neutral' | 'success' | 'danger' | 'glass';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  dot?: boolean;
}

export function Badge({ label, tone = 'neutral', style, dot }: BadgeProps) {
  const t = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string; border?: string }> = {
    gold: { bg: t.c.gold, fg: t.c.onGold },
    free: { bg: t.c.successDim, fg: t.c.success, border: t.c.success },
    live: { bg: t.c.live, fg: t.c.onStatus },
    neutral: { bg: t.c.surface2, fg: t.c.textMuted, border: t.c.border },
    success: { bg: t.c.successDim, fg: t.c.success },
    danger: { bg: t.c.dangerDim, fg: t.c.danger },
    glass: { bg: t.c.scrim, fg: t.c.onImage },
  };
  const s = map[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.badge,
        { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', borderWidth: s.border ? StyleSheet.hairlineWidth : 0 },
        style,
      ]}
    >
      {dot ? <PulseDot color={s.fg} /> : null}
      <AppText variant="overline" color={s.fg} style={{ letterSpacing: 0.8, fontSize: 10 }}>
        {label}
      </AppText>
    </View>
  );
}

function PulseDot({ color }: { color: string }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (t.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t.reduceMotion, v]);
  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity: v }]} />;
}

/** FREE / LIVE / Starts in … badge that keeps itself current. */
export function TimingBadge({ start, end, isFree, style }: { start?: string; end?: string; isFree?: boolean; style?: StyleProp<ViewStyle> }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const timing = eventTiming(start, end);
  if (timing.kind === 'live') return <Badge label="Live" tone="live" dot style={style} />;
  if (timing.kind === 'startsIn') return <Badge label={`Starts in ${timing.label}`} tone="glass" style={style} />;
  if (isFree) return <Badge label="Free" tone="free" style={style} />;
  return null;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
