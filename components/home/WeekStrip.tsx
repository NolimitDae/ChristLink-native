import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { formatTime, sameDay, weekDays } from '../../lib/format';
import { AppText } from '../ui';
import type { Plan } from './types';

export function WeekStrip({ plans, signedIn }: { plans: Plan[]; signedIn: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const days = useMemo(() => weekDays(), []);
  const [selected, setSelected] = useState(0);
  const dayPlans = plans.filter(p => sameDay(days[selected], p.start)).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <View style={{ paddingHorizontal: t.space.md, gap: t.space.sm }}>
      <View style={styles.strip} accessibilityRole="tablist">
        {days.map((d, i) => {
          const active = i === selected;
          const has = plans.some(p => sameDay(d, p.start));
          const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => setSelected(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${i === 0 ? 'Today, ' : ''}${weekday} ${d.getDate()}${has ? ', you have plans' : ''}`}
              style={[
                styles.pill,
                {
                  borderRadius: t.radius.md,
                  backgroundColor: active ? t.c.gold : t.c.surface,
                  borderColor: active ? t.c.gold : i === 0 ? t.c.goldHairline : t.c.border,
                },
              ]}
            >
              <AppText variant="caption" color={active ? t.c.onGold : t.c.textMuted} style={{ fontSize: 11 }}>
                {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
              </AppText>
              <AppText variant="headline" color={active ? t.c.onGold : t.c.text}>
                {d.getDate()}
              </AppText>
              <View style={[styles.dot, { backgroundColor: has ? (active ? t.c.onGold : t.c.gold) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {dayPlans.length > 0 ? (
        <View style={{ gap: 6 }}>
          {dayPlans.map(p => (
            <Pressable
              key={`${p.kind}-${p.eventId}`}
              onPress={() => router.push(`/event/${p.eventId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name} at ${formatTime(p.start)}`}
              style={({ pressed }) => [
                styles.plan,
                { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.md, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.bar, { backgroundColor: t.c.gold }]} />
              <AppText variant="caption" tone="gold" style={{ width: 64 }}>
                {formatTime(p.start)}
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {p.name}
              </AppText>
              <Ionicons name={p.kind === 'ticket' ? 'ticket-outline' : 'checkmark-circle-outline'} size={16} color={t.c.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => router.push(signedIn ? '/explore' : '/auth')}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.empty}
        >
          <AppText variant="callout" tone="muted">
            {signedIn ? 'Nothing planned — ' : 'Sign in to see your week — '}
            <AppText variant="callout" tone="gold">
              {signedIn ? 'explore events' : 'sign in'}
            </AppText>
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 6, borderWidth: 1, minHeight: 64, gap: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 12, borderWidth: 1, minHeight: 44, overflow: 'hidden' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  empty: { paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
});
