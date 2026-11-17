import React, { useEffect, useRef } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPRING } from '../../lib/motion';

/**
 * A rounded gold bar for progress (0–1). The fill springs to each new value; Reduce Motion jumps there.
 * `label` is read out with the value, e.g. "Setup progress, 3 of 7".
 */
export function ProgressBar({
  value,
  label,
  valueText,
  height = 8,
  style,
}: {
  value: number;
  label: string;
  valueText?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (t.reduceMotion) {
      fill.setValue(clamped);
      return;
    }
    const anim = Animated.spring(fill, { toValue: clamped, ...SPRING.move, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [clamped, fill, t.reduceMotion]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100), text: valueText }}
      style={[{ height, borderRadius: height / 2, backgroundColor: t.c.borderStrong, overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: t.c.gold,
          width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
