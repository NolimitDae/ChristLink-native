import React, { memo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { timeAgo } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { Prayer } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, Button, IconButton, LightBurst } from '../ui';
import { RollingNumber } from './RollingNumber';

interface PrayerCardProps {
  prayer: Prayer;
  onPray: (prayer: Prayer) => void;
  onMarkAnswered: (prayer: Prayer) => void;
  onMenu: (prayer: Prayer) => void;
}

export const PrayerCard = memo(function PrayerCard({ prayer, onPray, onMarkAnswered, onMenu }: PrayerCardProps) {
  const t = useTheme();
  const s = useStyles();
  const glow = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);
  const answered = !!prayer.answered_at;
  const anonymous = prayer.is_anonymous || !prayer.author_name;
  const name = anonymous ? 'Anonymous' : prayer.author_name ?? 'Member';

  const pray = () => {
    if (prayer.has_prayed) return;
    haptic.success();
    setBurst(b => b + 1);
    glow.setValue(0);
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: t.reduceMotion ? 150 : 260, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: t.reduceMotion ? 400 : 900, delay: 200, useNativeDriver: true }),
    ]).start();
    onPray(prayer);
  };

  return (
    <View style={s.wrap}>
      <Animated.View pointerEvents="none" style={[s.glow, { opacity: glow }]} />
      <View style={[s.card, answered && s.cardAnswered]}>
        {answered ? (
          <View style={s.ribbon} accessibilityLabel="Answered">
            <Ionicons name="sparkles" size={11} color={t.c.onGold} />
            <AppText variant="overline" tone="onGold" style={{ fontSize: 9 }}>
              Answered
            </AppText>
          </View>
        ) : null}
        <View style={s.body}>
          <View style={s.header}>
            {anonymous ? (
              <View style={s.anon} accessibilityLabel="Anonymous">
                <Ionicons name="person" size={14} color={t.c.textFaint} />
              </View>
            ) : (
              <Avatar uri={prayer.author_avatar_url} name={name} color={prayer.author_avatar_color} size={28} />
            )}
            <View style={{ flex: 1 }}>
              <AppText variant="caption" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" tone="faint" style={{ fontSize: 11 }}>
                {timeAgo(prayer.created_at)}
              </AppText>
            </View>
            <IconButton icon="ellipsis-horizontal" label="Prayer options" tone="plain" size={30} color={t.c.textFaint} onPress={() => onMenu(prayer)} />
          </View>

          <AppText variant="callout" numberOfLines={12} style={{ marginTop: t.space.xs }}>
            {prayer.body}
          </AppText>

          {answered && prayer.testimony ? (
            <View style={s.testimony}>
              <AppText variant="overline" tone="gold" style={{ fontSize: 9 }}>
                Testimony
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={4} style={{ marginTop: 2 }}>
                {prayer.testimony}
              </AppText>
            </View>
          ) : null}

          <View style={s.footer}>
            <Pressable
              onPress={pray}
              disabled={prayer.has_prayed}
              accessibilityRole="button"
              accessibilityState={{ disabled: prayer.has_prayed, selected: prayer.has_prayed }}
              accessibilityLabel={prayer.has_prayed ? `You prayed. ${prayer.prayed_count} praying` : `I prayed. ${prayer.prayed_count} praying`}
              style={({ pressed }) => [s.prayBtn, prayer.has_prayed && s.prayBtnDone, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={prayer.has_prayed ? 'hand-left' : 'hand-left-outline'} size={14} color={prayer.has_prayed ? t.c.goldText : t.c.text} />
              <AppText variant="caption" tone={prayer.has_prayed ? 'gold' : 'default'}>
                {prayer.has_prayed ? 'Prayed ✓' : 'I prayed'}
              </AppText>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <RollingNumber value={prayer.prayed_count} tone={prayer.has_prayed ? 'gold' : 'muted'} />
              <Ionicons name="flame-outline" size={12} color={t.c.textFaint} />
            </View>
          </View>

          {prayer.is_mine && !answered ? (
            <Button title="Mark answered" variant="ghost" size="sm" icon="sparkles-outline" onPress={() => onMarkAnswered(prayer)} style={{ marginTop: 4, alignSelf: 'flex-start' }} />
          ) : null}
        </View>
        <LightBurst play={burst} size={140} />
      </View>
    </View>
  );
});

const useStyles = makeStyles(t => ({
  wrap: { marginBottom: t.space.sm },
  glow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: t.radius.lg + 3,
    borderWidth: 2,
    borderColor: t.c.gold,
    backgroundColor: t.c.goldDim,
    shadowColor: t.c.gold,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  card: {
    backgroundColor: t.c.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.c.border,
    overflow: 'hidden',
  },
  cardAnswered: { borderColor: t.c.goldHairline },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    backgroundColor: t.c.gold,
  },
  body: { padding: t.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  anon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.surface3,
  },
  testimony: {
    marginTop: t.space.xs,
    padding: t.space.xs,
    borderRadius: t.radius.sm,
    backgroundColor: t.c.goldDim,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.space.sm },
  prayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.c.borderStrong,
    backgroundColor: t.c.surface2,
  },
  prayBtnDone: { borderColor: t.c.goldHairline, backgroundColor: t.c.goldDim },
}));
