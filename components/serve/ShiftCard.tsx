import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { formatTimeRange } from '../../lib/format';
import type { ServeShift } from '../../lib/types';
import { AppText, Badge, Button, Card } from '../ui';
import { SpotsBar } from './SpotsBar';
import { isMyShift, spotsLeft } from './useShiftActions';

interface ShiftCardProps {
  shift: ServeShift;
  busy?: boolean;
  onSignUp: () => void;
  onCancel: () => void;
}

export function shiftPlace(shift: ServeShift): string {
  return shift.event_name ?? shift.church_name ?? 'Serve team';
}

export function ShiftCard({ shift, busy, onSignUp, onCancel }: ShiftCardProps) {
  const t = useTheme();
  const mine = isMyShift(shift);
  const full = spotsLeft(shift) === 0;
  return (
    <Card variant={mine ? 'featured' : 'standard'} style={{ gap: t.space.sm }}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline" numberOfLines={2}>
            {shift.role_name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {shiftPlace(shift)}
          </AppText>
        </View>
        {mine ? <Badge label="You're signed up" tone="success" /> : null}
      </View>
      <View style={styles.time}>
        <Ionicons name="time-outline" size={15} color={t.c.goldText} />
        <AppText variant="callout">{formatTimeRange(shift.starts_at, shift.ends_at)}</AppText>
      </View>
      {shift.description ? (
        <AppText variant="callout" tone="muted" numberOfLines={2}>
          {shift.description}
        </AppText>
      ) : null}
      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          <SpotsBar spots={shift.spots} taken={shift.taken} />
        </View>
        {mine ? (
          <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} loading={busy} />
        ) : (
          <Button
            title={full ? 'Full' : 'Sign up'}
            size="sm"
            onPress={onSignUp}
            disabled={full}
            loading={busy}
            accessibilityHint="Shows the shift details to confirm"
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
});
