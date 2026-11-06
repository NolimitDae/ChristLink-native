import React, { useRef } from 'react';
import { Animated, Easing, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPRING } from '../../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held (cards ~0.98, chips/buttons ~0.96). */
  scaleTo?: number;
}

/**
 * Press feedback the instant a finger lands (not on release), springing back without overshoot when it lifts.
 * Each change starts from the current on-screen value, so quick taps never jump. Reduce Motion: a dim instead.
 */
export function PressScale({ scaleTo = 0.97, style, onPressIn, onPressOut, children, ...rest }: PressScaleProps) {
  const t = useTheme();
  const v = useRef(new Animated.Value(1)).current;

  const pressIn = (e: GestureResponderEvent) => {
    Animated.timing(v, {
      toValue: t.reduceMotion ? 0.75 : scaleTo,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPressIn?.(e);
  };
  const pressOut = (e: GestureResponderEvent) => {
    Animated.spring(v, { toValue: 1, ...SPRING.press, useNativeDriver: true }).start();
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, t.reduceMotion ? { opacity: v } : { transform: [{ scale: v }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
