import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { AppText } from './AppText';
import { AppIcon, type AppIconName } from '../icons/AppIcon';

type IconName = AppIconName;

interface ListRowProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  destructive?: boolean;
  last?: boolean;
  disabled?: boolean;
}

export function ListRow({ icon, title, subtitle, value, onPress, toggle, onToggle, destructive, last, disabled }: ListRowProps) {
  const t = useTheme();
  const fg = destructive ? t.c.danger : t.c.text;
  const content = (
    <View style={[styles.row, { borderBottomColor: t.c.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.5 : 1 }]}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: destructive ? t.c.dangerDim : t.c.goldDim }]}>
          <AppIcon name={icon} size={17} color={destructive ? t.c.danger : t.c.goldText} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={fg}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" tone="muted">
          {value}
        </AppText>
      ) : null}
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          disabled={disabled}
          onValueChange={v => {
            haptic.tap();
            onToggle?.(v);
          }}
          trackColor={{ false: t.c.surface3, true: t.c.gold }}
          thumbColor="#FFFFFF"
          accessibilityLabel={title}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
      ) : null}
    </View>
  );
  if (!onPress || toggle !== undefined) return content;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function ListGroup({ children, title }: { children: React.ReactNode; title?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.space.lg }}>
      {title ? (
        <AppText variant="overline" tone="muted" style={{ marginLeft: 4, marginBottom: 8 }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
