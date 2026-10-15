import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (t.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, t.reduceMotion]);
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: t.c.skeleton, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: t.c.skeletonHighlight, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }) },
        ]}
      />
    </View>
  );
}

export function SkeletonGroup({ children, label = 'Loading' }: { children: React.ReactNode; label?: string }) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      {children}
    </View>
  );
}

export function EventCardSkeleton({ variant = 'carousel' }: { variant?: 'carousel' | 'row' }) {
  const t = useTheme();
  if (variant === 'row') {
    return (
      <View style={[styles.row, { borderColor: t.c.border, backgroundColor: t.c.surface, borderRadius: t.radius.lg }]}>
        <Skeleton width={86} height={86} radius={t.radius.md} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="40%" height={10} />
          <Skeleton width="85%" height={16} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ width: 280, gap: 10 }}>
      <Skeleton height={170} radius={t.radius.lg} />
      <Skeleton width="80%" height={16} />
      <Skeleton width="55%" height={12} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup>
      <View style={{ gap: 12, padding: 16 }}>
        {Array.from({ length: rows }, (_, i) => (
          <EventCardSkeleton key={i} variant="row" />
        ))}
      </View>
    </SkeletonGroup>
  );
}

export function PostSkeleton() {
  const t = useTheme();
  return (
    <View style={[styles.post, { borderColor: t.c.border, backgroundColor: t.c.surface, borderRadius: t.radius.lg }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Skeleton width={36} height={36} radius={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="20%" height={10} />
        </View>
      </View>
      <Skeleton height={12} />
      <Skeleton width="75%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 10, borderWidth: 1, alignItems: 'center' },
  post: { padding: 16, gap: 12, borderWidth: 1 },
});
