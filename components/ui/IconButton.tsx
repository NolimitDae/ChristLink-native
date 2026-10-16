import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'default' | 'gold' | 'glass' | 'plain';
  color?: string;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function IconButton({ icon, label, onPress, size = 40, tone = 'default', color, badge, style, disabled }: IconButtonProps) {
  const t = useTheme();
  const bg =
    tone === 'gold' ? t.c.gold : tone === 'glass' ? 'rgba(14,12,10,0.55)' : tone === 'plain' ? 'transparent' : t.c.surface2;
  const fg = color ?? (tone === 'gold' ? t.c.onGold : tone === 'glass' ? '#F6EFE3' : t.c.text);
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: tone === 'default' ? t.c.border : 'transparent',
          borderWidth: tone === 'default' ? StyleSheet.hairlineWidth : 0,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
      {badge ? <View style={[styles.badge, { backgroundColor: t.c.live, borderColor: t.c.bg }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
