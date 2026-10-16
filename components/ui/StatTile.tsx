import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from './AppText';
import { Card } from './Card';
import { Sparkline } from './Sparkline';

export function StatTile({ label, value, trend, tone = 'default', onPress }: { label: string; value: string; trend?: number[]; tone?: 'default' | 'gold' | 'success'; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 150, gap: 6 }} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="overline" tone="muted" style={{ fontSize: 10 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <AppText variant="numeral" tone={tone === 'gold' ? 'gold' : tone === 'success' ? 'success' : 'default'} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        {trend && trend.some(v => v > 0) ? <Sparkline values={trend} width={64} height={26} color={tone === 'success' ? t.c.success : undefined} /> : null}
      </View>
    </Card>
  );
}
