import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';

/** Frosted-glass surface. Android blur is costly and inconsistent, so it uses a tinted solid there. */
export function Glass({ children, style, intensity = 40 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; intensity?: number }) {
  const t = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={t.scheme === 'dark' ? 'dark' : 'light'} style={[{ backgroundColor: t.c.glass }, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[{ backgroundColor: t.scheme === 'dark' ? 'rgba(20,17,14,0.94)' : 'rgba(255,253,248,0.96)' }, style]}>{children}</View>;
}

export const glassBorder = StyleSheet.hairlineWidth;
