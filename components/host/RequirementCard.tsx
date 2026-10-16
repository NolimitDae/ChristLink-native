import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { AppText } from '../ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface RequirementRowProps {
  icon: IconName;
  title: string;
  body?: string;
  done?: boolean;
  onPress?: () => void;
  tone?: 'gold' | 'danger';
  last?: boolean;
}

/** One setup item: icon, title/body and a chevron. Done items show a check. */
export function RequirementRow({ icon, title, body, done, onPress, tone = 'gold', last }: RequirementRowProps) {
  const t = useTheme();
  const s = useStyles();
  const fg = done ? t.c.success : tone === 'danger' ? t.c.danger : t.c.goldText;
  const bg = done ? t.c.successDim : tone === 'danger' ? t.c.dangerDim : t.c.goldDim;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || done}
      accessibilityRole="button"
      accessibilityLabel={`${title}${done ? ', done' : ''}`}
      accessibilityHint={body}
      style={({ pressed }) => [s.row, !last && s.divider, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[s.icon, { backgroundColor: bg }]}>
        <Ionicons name={done ? 'checkmark' : icon} size={18} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {body ? (
          <AppText variant="caption" tone="muted">
            {body}
          </AppText>
        ) : null}
      </View>
      {onPress && !done ? <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: 60, paddingVertical: t.space.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: t.c.border },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
}));
