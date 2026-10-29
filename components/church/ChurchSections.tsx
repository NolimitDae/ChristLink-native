import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { describeRule, nextOccurrences } from '../../lib/recurrence';
import { formatDateShort, formatTimeRange } from '../../lib/format';
import type { Church, ChurchRecurringEvent, ServeShift } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText } from '../ui';
import { serviceTimeLabel } from './churchFormat';
import { AppIcon } from '../icons/AppIcon';

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.sm }}>
      <View style={styles.sectionHead}>
        <AppText variant="title3" style={{ flexShrink: 1 }}>
          {title}
        </AppText>
        <View style={[styles.hairline, { backgroundColor: t.c.goldHairline }]} />
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${action}: ${title}`}>
            <AppText variant="caption" tone="gold">
              {action}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function ServiceTimes({ church, recurring }: { church: Church; recurring: ChurchRecurringEvent[] }) {
  const t = useTheme();
  const items = [
    ...(church.service_times ?? []).map((st, i) => ({ key: `st-${i}`, label: serviceTimeLabel(st) })),
    ...recurring.filter(r => r.is_service).map(r => ({ key: r.id, label: `${r.name} · ${describeRule(r)}` })),
  ];
  if (items.length === 0) return null;
  return (
    <Section title="Service times">
      <View style={styles.chips}>
        {items.map(i => (
          <View key={i.key} style={[styles.chip, { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline, borderRadius: t.radius.pill }]}>
            <Ionicons name="time-outline" size={14} color={t.c.goldText} />
            <AppText variant="caption" style={{ fontSize: 13 }}>
              {i.label}
            </AppText>
          </View>
        ))}
      </View>
    </Section>
  );
}

export function RecurringList({ recurring }: { recurring: ChurchRecurringEvent[] }) {
  const t = useTheme();
  const list = recurring.filter(r => !r.is_service);
  if (list.length === 0) return null;
  return (
    <Section title="Recurring gatherings">
      <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
        {list.map((r, i) => {
          const next = nextOccurrences(r, new Date(), 1)[0];
          return (
            <View
              key={r.id}
              style={[styles.groupRow, { borderBottomColor: t.c.border, borderBottomWidth: i === list.length - 1 ? 0 : StyleSheet.hairlineWidth }]}
              accessible
              accessibilityLabel={`${r.name}. ${describeRule(r)}${next ? `. Next ${next.toDateString()}` : ''}`}
            >
              <View style={[styles.icon, { backgroundColor: t.c.goldDim }]}>
                <Ionicons name="repeat" size={16} color={t.c.goldText} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{r.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {describeRule(r)}
                  {r.location ? ` · ${r.location}` : ''}
                </AppText>
              </View>
              {next ? (
                <AppText variant="caption" tone="gold">
                  Next {formatDateShort(next.toISOString())}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

export function Leaders({ leaders }: { leaders: Church['leaders'] }) {
  const t = useTheme();
  if (!leaders?.length) return null;
  return (
    <Section title="Leaders">
      <View style={styles.leaders}>
        {leaders.map((l, i) => (
          <View
            key={`${l.name}-${i}`}
            style={[styles.leader, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}
          >
            <Avatar name={l.name} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {l.name}
              </AppText>
              {l.title ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {l.title}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

export function ServeHere({ shifts, onOpen }: { shifts: ServeShift[]; onOpen: () => void }) {
  const t = useTheme();
  if (shifts.length === 0) return null;
  return (
    <Section title="Serve here" action="See all" onAction={onOpen}>
      <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
        {shifts.slice(0, 3).map((s, i, arr) => {
          const left = Math.max(0, s.spots - s.taken);
          return (
            <Pressable
              key={s.shift_id}
              onPress={onOpen}
              accessibilityRole="button"
              accessibilityLabel={`${s.role_name}, ${formatDateShort(s.starts_at)}. ${left} spots left`}
              style={({ pressed }) => [
                styles.groupRow,
                { borderBottomColor: t.c.border, borderBottomWidth: i === arr.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: t.c.goldDim }]}>
                <AppIcon name="serve-outline" size={16} color={t.c.goldText} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{s.role_name}</AppText>
                <AppText variant="caption" tone="muted">
                  {formatDateShort(s.starts_at)} · {formatTimeRange(s.starts_at, s.ends_at)}
                </AppText>
              </View>
              <AppText variant="caption" tone={left === 0 ? 'faint' : 'gold'}>
                {left === 0 ? 'Full' : `${left} left`}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  group: { borderWidth: 1, paddingHorizontal: 14 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  leaders: { gap: 8 },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
});
