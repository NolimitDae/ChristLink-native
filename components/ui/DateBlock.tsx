import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { dateBlockParts } from '../../lib/format';
import { AppText } from './AppText';

export function DateBlock({ iso, size = 'md', glass, style }: { iso?: string; size?: 'sm' | 'md'; glass?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { month, day } = dateBlockParts(iso);
  const w = size === 'sm' ? 44 : 54;
  return (
    <View
      accessible
      accessibilityLabel={iso ? new Date(iso).toDateString() : 'Date to be announced'}
      style={[
        styles.block,
        {
          width: w,
          borderRadius: t.radius.sm,
          backgroundColor: glass ? 'rgba(14,12,10,0.62)' : t.c.surface2,
          borderColor: glass ? 'rgba(201,168,76,0.5)' : t.c.goldHairline,
        },
        style,
      ]}
    >
      <AppText variant="overline" color={glass ? '#D9BC6A' : t.c.goldText} style={{ fontSize: size === 'sm' ? 9 : 10 }}>
        {month}
      </AppText>
      <AppText variant={size === 'sm' ? 'title3' : 'title2'} color={glass ? '#F6EFE3' : t.c.text} style={{ lineHeight: size === 'sm' ? 22 : 28 }}>
        {day}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderWidth: 1 },
});
