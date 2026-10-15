import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { PersonSummary } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText } from './AppText';

interface AvatarStackProps {
  people: PersonSummary[];
  max?: number;
  size?: number;
  total?: number;
  borderColor?: string;
}

export function AvatarStack({ people, max = 3, size = 26, total, borderColor }: AvatarStackProps) {
  const t = useTheme();
  const shown = people.slice(0, max);
  const extra = Math.max(0, (total ?? people.length) - shown.length);
  if (shown.length === 0) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${total ?? people.length} people`}>
      {shown.map((p, i) => (
        <View
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.32,
            borderRadius: size,
            borderWidth: 2,
            borderColor: borderColor ?? t.c.surface,
            zIndex: max - i,
          }}
        >
          <Avatar uri={p.avatar_url} name={p.full_name} color={p.avatar_color} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: size,
              marginLeft: -size * 0.32,
              backgroundColor: t.c.surface3,
              borderColor: borderColor ?? t.c.surface,
            },
          ]}
        >
          <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>
            +{extra > 99 ? '99' : extra}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
