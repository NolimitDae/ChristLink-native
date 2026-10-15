import React from 'react';
import { Pressable, View } from 'react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { AppText } from '../ui';

interface StepProgressProps {
  steps: readonly string[];
  current: number;
  onStepPress?: (i: number) => void;
}

/** Four labeled segments; completed steps are tappable to jump back. */
export function StepProgress({ steps, current, onStepPress }: StepProgressProps) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.row} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Pressable
            key={label}
            disabled={!done || !onStepPress}
            onPress={() => onStepPress?.(i)}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${label}${active ? ', current' : done ? ', completed' : ''}`}
            accessibilityState={{ disabled: !done, selected: active }}
            style={s.step}
            hitSlop={6}
          >
            <View style={[s.bar, { backgroundColor: done || active ? t.c.gold : t.c.surface3 }]} />
            <AppText variant="caption" tone={active ? 'gold' : done ? 'default' : 'faint'} numberOfLines={1} style={{ fontSize: 11 }}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', gap: t.space.xs },
  step: { flex: 1, gap: 6, minHeight: 32 },
  bar: { height: 4, borderRadius: 2 },
}));
