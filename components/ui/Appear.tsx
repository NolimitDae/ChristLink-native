import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPRING } from '../../lib/motion';

const STAGGER_MS = 45;
const MAX_STAGGER = 6;

/**
 * Content arriving after its skeleton: a short rise and fade, staggered by `index` so a list settles top-down.
 * Runs once on mount. Reduce Motion: a plain cross-fade, no movement.
 */
export function Appear({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index, MAX_STAGGER) * STAGGER_MS;
    const anim = t.reduceMotion
      ? Animated.timing(v, { toValue: 1, duration: 180, delay, useNativeDriver: true })
      : Animated.spring(v, { toValue: 1, delay, ...SPRING.move, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, index, t.reduceMotion]);

  const rise = v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={[style, { opacity: v }, t.reduceMotion ? null : { transform: [{ translateY: rise }] }]}>{children}</Animated.View>
  );
}
