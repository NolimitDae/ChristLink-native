import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from '../ui';

export function SpotsBar({ spots, taken }: { spots: number; taken: number }) {
  const t = useTheme();
  const left = Math.max(0, spots - taken);
  const ratio = spots > 0 ? Math.min(1, taken / spots) : 1;
  const label = left === 0 ? 'All spots filled' : `${left} of ${spots} spots left`;
  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: spots, now: taken }}
    >
      <AppText variant="caption" tone={left === 0 ? 'faint' : left <= 2 ? 'gold' : 'muted'}>
        {label}
      </AppText>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.c.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${ratio * 100}%`, height: 6, borderRadius: 3, backgroundColor: left === 0 ? t.c.textFaint : t.c.gold }} />
      </View>
    </View>
  );
}
