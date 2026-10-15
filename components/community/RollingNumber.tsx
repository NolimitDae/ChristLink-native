import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { TypeVariant } from '../../lib/theme';
import { AppText, type TextTone } from '../ui/AppText';

/** Counts from the previous value to the new one over ~600ms. */
export function RollingNumber({
  value,
  variant = 'caption',
  tone = 'muted',
  style,
}: {
  value: number;
  variant?: TypeVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  const [shown, setShown] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    if (t.reduceMotion) {
      anim.setValue(value);
      setShown(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() =>
      setShown(value),
    );
    return () => anim.removeListener(id);
  }, [value, anim, t.reduceMotion]);

  return (
    <AppText variant={variant} tone={tone} style={style}>
      {shown}
    </AppText>
  );
}
