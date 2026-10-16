import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { AppText } from '../ui';

interface CheckRowProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function CheckRow({ checked, onChange, label, children, disabled }: CheckRowProps) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onChange(!checked);
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [s.row, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <View style={[s.box, checked ? { backgroundColor: t.c.gold, borderColor: t.c.gold } : null]}>
        {checked ? <Ionicons name="checkmark" size={16} color={t.c.onGold} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children ?? <AppText variant="callout">{label}</AppText>}</View>
    </Pressable>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm, minHeight: 44, paddingVertical: 4 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: t.c.borderStrong,
    backgroundColor: t.c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
}));
