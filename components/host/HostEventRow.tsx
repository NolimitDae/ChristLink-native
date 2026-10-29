import React from 'react';
import { Pressable, View } from 'react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { formatDateShort, formatTime } from '../../lib/format';
import { locationLabel, priceLabel } from '../../lib/eventHelpers';
import type { Event } from '../../lib/types';
import { AppText, Badge, DateBlock, IconButton, TimingBadge } from '../ui';
import { AppIcon, type AppIconName } from '../icons/AppIcon';

type IconName = AppIconName;

export interface RowAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
}

interface HostEventRowProps {
  event: Event;
  actions: RowAction[];
  onOpen: () => void;
  onMore: () => void;
}

export function statusBadge(e: Event): { label: string; tone: 'neutral' | 'gold' | 'success' | 'danger' } {
  if (e.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' };
  if (e.status === 'draft' && e.publish_at) return { label: 'Scheduled', tone: 'gold' };
  if (e.status === 'draft') return { label: 'Draft', tone: 'neutral' };
  if (e.status === 'completed') return { label: 'Completed', tone: 'neutral' };
  return { label: 'Published', tone: 'success' };
}

export function HostEventRow({ event, actions, onOpen, onMore }: HostEventRowProps) {
  const t = useTheme();
  const s = useStyles();
  const badge = statusBadge(event);
  const sold = event.ticket_types.reduce((n, tt) => n + (tt.tickets_sold ?? 0), 0);
  const stat = event.is_paid ? `${sold} sold` : `${event.going_count} going`;
  return (
    <View style={s.card}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${event.name}, ${badge.label}, ${stat}`} style={({ pressed }) => [s.top, { opacity: pressed ? 0.85 : 1 }]}>
        <DateBlock iso={event.start_date} size="sm" />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={s.badges}>
            <Badge label={badge.label} tone={badge.tone} />
            <TimingBadge start={event.start_date} end={event.end_date} />
          </View>
          <AppText variant="headline" numberOfLines={2}>
            {event.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {formatDateShort(event.start_date)} · {formatTime(event.start_date) || 'Time TBA'} · {locationLabel(event)}
          </AppText>
          <AppText variant="caption" tone="gold">
            {stat} · {priceLabel(event)}
          </AppText>
        </View>
        <IconButton icon="ellipsis-horizontal" label={`More actions for ${event.name}`} size={36} tone="plain" onPress={onMore} />
      </Pressable>
      {actions.length > 0 ? (
        <View style={s.actions}>
          {actions.map(a => (
            <Pressable
              key={a.key}
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${a.label}: ${event.name}`}
              style={({ pressed }) => [s.action, a.primary && { backgroundColor: t.c.gold, borderColor: t.c.gold }, { opacity: pressed ? 0.75 : 1 }]}
            >
              <AppIcon name={a.icon} size={15} color={a.primary ? t.c.onGold : t.c.goldText} />
              <AppText variant="caption" color={a.primary ? t.c.onGold : t.c.text}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  card: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, overflow: 'hidden' },
  top: { flexDirection: 'row', gap: t.space.sm, padding: t.space.sm, alignItems: 'flex-start' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: t.space.xs, paddingHorizontal: t.space.sm, paddingBottom: t.space.sm, flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface2,
  },
}));
