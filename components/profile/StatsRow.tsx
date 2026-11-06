import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, PressScale } from '../ui';

export interface Stat {
  label: string;
  value: string;
  hint?: string;
  onPress?: () => void;
}

export function StatsRow({ stats }: { stats: Stat[] }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.c.border,
        backgroundColor: t.c.surface,
      }}
    >
      {stats.map((st, i) => (
        <PressScale
          key={st.label}
          scaleTo={0.94}
          onPress={st.onPress}
          disabled={!st.onPress}
          accessibilityRole={st.onPress ? 'button' : 'text'}
          accessibilityLabel={`${st.label}: ${st.value}${st.hint ? `. ${st.hint}` : ''}`}
          accessibilityHint={st.onPress ? `Opens the ${st.label.toLowerCase()} list` : undefined}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: 2,
            minHeight: 44,
            justifyContent: 'center',
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: t.c.border,
          }}
        >
          <AppText variant="numeral" style={{ fontSize: 22, lineHeight: 26 }}>
            {st.value}
          </AppText>
          <AppText variant="caption" tone="muted" align="center" style={{ fontSize: 11 }} numberOfLines={1}>
            {st.label}
          </AppText>
        </PressScale>
      ))}
    </View>
  );
}
