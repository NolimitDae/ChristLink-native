import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const RAYS = 12;

/**
 * Signature moment: a gold light burst (expanding ring + radiating rays) used for RSVP confirmed,
 * ticket purchased and "I prayed". Respects Reduce Motion by fading only.
 */
export function LightBurst({ play, size = 220, onDone }: { play: number; size?: number; onDone?: () => void }) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!play) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: t.reduceMotion ? 400 : t.motion.celebrate,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDone?.());
  }, [play, progress, t.reduceMotion, t.motion.celebrate, onDone]);

  if (!play) return null;
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
  const ringScale = t.reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.3] });
  const rayScale = t.reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.15] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.c.goldDim,
          borderWidth: 2,
          borderColor: t.c.gold,
          opacity,
          transform: [{ scale: ringScale }],
        }}
      />
      <Animated.View style={{ position: 'absolute', width: size, height: size, opacity, transform: [{ scale: rayScale }] }}>
        {Array.from({ length: RAYS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.ray,
              {
                backgroundColor: t.c.gold,
                left: size / 2 - 1.5,
                top: 0,
                height: size / 2,
                transform: [{ translateY: size / 4 }, { rotate: `${(360 / RAYS) * i}deg` }, { translateY: -size / 4 }],
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 3, borderRadius: 2, opacity: 0.7 },
});
