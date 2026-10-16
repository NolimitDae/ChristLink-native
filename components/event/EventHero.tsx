import React from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { eventGlyph } from '../../lib/eventHelpers';
import type { Event } from '../../lib/types';
import { AppText } from '../ui/AppText';

interface EventHeroProps {
  event: Pick<Event, 'cover_url' | 'emoji' | 'event_type' | 'name'>;
  height: number;
  scrollY: Animated.Value;
}

/** Stretchy cover: scales up on pull-down (top stays pinned), parallaxes on scroll-up. */
export function EventHero({ event, height, scrollY }: EventHeroProps) {
  const t = useTheme();
  const translateY = scrollY.interpolate({
    inputRange: [-height, 0, height],
    outputRange: [-height / 2, 0, height * 0.45],
    extrapolateRight: 'clamp',
  });
  const scale = scrollY.interpolate({ inputRange: [-height, 0, 1], outputRange: [2, 1, 1], extrapolateRight: 'clamp' });

  return (
    <View style={{ height }} accessible accessibilityRole="image" accessibilityLabel={`Cover photo for ${event.name}`}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { scale }] }]}>
        {event.cover_url ? (
          <Image source={{ uri: event.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <LinearGradient colors={[t.c.surface3, t.c.surface, t.c.bg]} style={[StyleSheet.absoluteFill, styles.center]}>
            <View style={[styles.glyphRing, { borderColor: t.c.goldHairline, backgroundColor: t.c.goldDim }]}>
              <AppText style={{ fontSize: 64, lineHeight: 78 }}>{eventGlyph(event)}</AppText>
            </View>
          </LinearGradient>
        )}
        <LinearGradient colors={['rgba(14,12,10,0.55)', 'transparent']} style={styles.topShade} pointerEvents="none" />
      </Animated.View>
      <LinearGradient colors={['transparent', t.c.bg]} style={styles.bottomFade} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  glyphRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 140 },
});
