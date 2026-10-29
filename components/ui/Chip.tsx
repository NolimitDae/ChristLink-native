import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { AppText } from './AppText';
import { AppIcon, type AppIconName } from '../icons/AppIcon';

type IconName = AppIconName;

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  count?: number;
}

export function Chip({ label, selected = false, onPress, icon, style, count }: ChipProps) {
  const t = useTheme();
  const fg = selected ? t.c.onGold : t.c.text;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.c.gold : t.c.surface,
          borderColor: selected ? t.c.gold : t.c.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon ? <AppIcon name={icon} size={14} color={selected ? t.c.onGold : t.c.goldText} /> : null}
      <AppText variant="caption" color={fg} style={{ fontSize: 13 }}>
        {label}
      </AppText>
      {count !== undefined ? (
        <AppText variant="caption" color={selected ? t.c.onGold : t.c.textFaint}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

interface ChipRowProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: StyleProp<ViewStyle>;
}

export function ChipRow<T extends string>({ options, value, onChange, labels, style }: ChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]}>
      {options.map(o => (
        <Chip key={o} label={labels?.[o] ?? o} selected={o === value} onPress={() => onChange(o)} />
      ))}
      <View style={{ width: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
  },
  row: { gap: 8, paddingHorizontal: 16 },
});
