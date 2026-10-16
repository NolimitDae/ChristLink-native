import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { haptic } from '../lib/haptics';
import { formatDateShort, formatTime, friendsGoingLabel } from '../lib/format';
import { eventGlyph, locationLabel, priceLabel } from '../lib/eventHelpers';
import { shadow } from '../lib/theme';
import type { Event, FriendsGoing } from '../lib/types';
import { AppText } from './ui/AppText';
import { AvatarStack } from './ui/AvatarStack';
import { DateBlock } from './ui/DateBlock';
import { TimingBadge } from './ui/Badge';

export type EventCardVariant = 'carousel' | 'row' | 'grid';

interface EventCardProps {
  event: Event;
  variant?: EventCardVariant;
  friends?: FriendsGoing;
  width?: number;
  onPress?: () => void;
}

function SaveHeart({ eventId, onImage }: { eventId: string; onImage?: boolean }) {
  const t = useTheme();
  const { savedIds, toggleSaved } = useAppData();
  const saved = savedIds.has(eventId);
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        toggleSaved(eventId);
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save event'}
      accessibilityState={{ selected: saved }}
      style={[styles.heart, onImage ? { backgroundColor: 'rgba(14,12,10,0.55)' } : { backgroundColor: t.c.surface2 }]}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? t.c.gold : onImage ? '#F6EFE3' : t.c.textMuted} />
    </Pressable>
  );
}

function PriceChip({ event }: { event: Event }) {
  const t = useTheme();
  const free = !event.is_paid;
  return (
    <View style={[styles.price, { backgroundColor: free ? t.c.successDim : t.c.gold, borderColor: free ? t.c.success : t.c.gold }]}>
      <AppText variant="caption" color={free ? t.c.success : t.c.onGold} style={{ fontSize: 12 }}>
        {priceLabel(event)}
      </AppText>
    </View>
  );
}

function FriendsRow({ event, friends }: { event: Event; friends?: FriendsGoing }) {
  const people = friends?.friends ?? [];
  const label = friendsGoingLabel(
    people.map(p => p.full_name),
    friends?.friend_count ?? 0,
    event.going_count,
  );
  return (
    <View style={styles.friends}>
      {people.length > 0 ? <AvatarStack people={people} max={3} size={20} total={friends?.friend_count} /> : null}
      <AppText variant="caption" tone={people.length > 0 ? 'gold' : 'muted'} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

function Cover({ event, height, radius }: { event: Event; height: number; radius: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: t.c.surface2 }}>
      {event.cover_url ? (
        <Image source={{ uri: event.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[t.c.surface3, t.c.surface]} style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText style={{ fontSize: height > 120 ? 44 : 30 }}>{eventGlyph(event)}</AppText>
        </LinearGradient>
      )}
    </View>
  );
}

function EventCardInner({ event, variant = 'row', friends, width = 280, onPress }: EventCardProps) {
  const t = useTheme();
  const router = useRouter();
  const open = onPress ?? (() => router.push(`/event/${event.id}`));
  const meta = `${formatDateShort(event.start_date)}${event.start_date ? ` · ${formatTime(event.start_date)}` : ''} · ${locationLabel(event)}`;
  const a11y = `${event.name}. ${meta}. ${priceLabel(event)}.`;

  if (variant === 'carousel') {
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [{ width, opacity: pressed ? 0.9 : 1 }]}>
        <View style={[{ borderRadius: t.radius.lg }, shadow(2, t.c.shadow)]}>
          <Cover event={event} height={Math.round(width * 0.62)} radius={t.radius.lg} />
          <LinearGradient colors={['transparent', 'rgba(14,12,10,0.85)']} style={[StyleSheet.absoluteFill, { borderRadius: t.radius.lg }]} />
          <View style={styles.overlayTop}>
            <DateBlock iso={event.start_date} size="sm" glass />
            <SaveHeart eventId={event.id} onImage />
          </View>
          <View style={styles.overlayBottom}>
            <TimingBadge start={event.start_date} end={event.end_date} />
            <AppText variant="title3" color="#F6EFE3" numberOfLines={2} style={{ marginTop: 6 }}>
              {event.name}
            </AppText>
          </View>
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          <View style={styles.rowBetween}>
            <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {meta}
            </AppText>
            <PriceChip event={event} />
          </View>
          <FriendsRow event={event} friends={friends} />
        </View>
      </Pressable>
    );
  }

  if (variant === 'grid') {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [
          { flex: 1, backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, overflow: 'hidden', opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Cover event={event} height={110} radius={0} />
        <View style={{ padding: 10, gap: 4 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {event.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {formatDateShort(event.start_date)}
          </AppText>
          <PriceChip event={event} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg, opacity: pressed ? 0.9 : 1 },
        t.scheme === 'light' ? shadow(1, t.c.shadow) : null,
      ]}
    >
      <DateBlock iso={event.start_date} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.rowBetween}>
          <AppText variant="overline" tone="gold" numberOfLines={1} style={{ fontSize: 10, flex: 1 }}>
            {event.event_type ?? 'Gathering'}
          </AppText>
          <TimingBadge start={event.start_date} end={event.end_date} />
        </View>
        <AppText variant="headline" numberOfLines={2}>
          {event.name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {formatTime(event.start_date) || 'Time TBA'} · {locationLabel(event)}
        </AppText>
        <View style={[styles.rowBetween, { marginTop: 4 }]}>
          <FriendsRow event={event} friends={friends} />
          <PriceChip event={event} />
        </View>
      </View>
      <SaveHeart eventId={event.id} />
    </Pressable>
  );
}

export const EventCard = memo(EventCardInner);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  heart: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  price: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  friends: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  overlayTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  overlayBottom: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderWidth: 1, alignItems: 'flex-start' },
});
