import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPrayerWall } from '../../lib/features';
import { pluralize, timeAgo } from '../../lib/format';
import { shadow } from '../../lib/theme';
import type { Prayer } from '../../lib/types';
import { AppText, Button, Card, SectionHeader, Skeleton } from '../ui';

const PRAYER_ROUTE = '/(tabs)/community?view=prayer';
const CARD_W = 220;

function Gap() {
  return <View style={{ width: 12 }} />;
}

function PrayerCard({ prayer, onPress }: { prayer: Prayer; onPress: () => void }) {
  const t = useTheme();
  const author = prayer.is_anonymous || !prayer.author_name ? 'Anonymous' : prayer.author_name;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Prayer from ${author}: ${prayer.body}. ${pluralize(prayer.prayed_count, 'person', 'people')} prayed`}
      style={({ pressed }) => [
        styles.card,
        {
          width: CARD_W,
          backgroundColor: t.c.surface,
          borderColor: prayer.answered_at ? t.c.goldHairline : t.c.border,
          borderRadius: t.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
        t.scheme === 'light' ? shadow(1, t.c.shadow) : null,
      ]}
    >
      <AppText variant="caption" tone={prayer.answered_at ? 'gold' : 'faint'} numberOfLines={1}>
        {prayer.answered_at ? 'Answered · ' : ''}
        {author} · {timeAgo(prayer.created_at)}
      </AppText>
      <AppText variant="callout" numberOfLines={3} style={{ flex: 1 }}>
        {prayer.body}
      </AppText>
      <View style={styles.foot}>
        <Ionicons name={prayer.has_prayed ? 'heart' : 'heart-outline'} size={14} color={t.c.goldText} />
        <AppText variant="caption" tone="gold">
          {prayer.prayed_count} prayed
        </AppText>
      </View>
    </Pressable>
  );
}

export function PrayerRow({ refreshKey }: { refreshKey: number }) {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [prayers, setPrayers] = useState<Prayer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPrayerWall('all')
      .then(list => {
        if (!cancelled) setPrayers(list.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setPrayers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const open = () => router.push(PRAYER_ROUTE);

  return (
    <View>
      <SectionHeader title="Pray with your community" actionLabel={prayers && prayers.length > 0 ? 'See all' : undefined} onAction={open} />
      {prayers === null ? (
        <View style={[styles.skelRow, { paddingHorizontal: t.space.md }]}>
          {[0, 1].map(i => (
            <View key={i} style={[styles.card, { width: CARD_W, borderColor: t.c.border, borderRadius: t.radius.lg, backgroundColor: t.c.surface }]}>
              <Skeleton width="50%" height={10} />
              <Skeleton height={12} />
              <Skeleton width="80%" height={12} />
            </View>
          ))}
        </View>
      ) : prayers.length > 0 ? (
        <FlatList
          data={prayers}
          horizontal
          keyExtractor={p => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: t.space.md, paddingVertical: 2 }}
          ItemSeparatorComponent={Gap}
          renderItem={({ item }: ListRenderItemInfo<Prayer>) => <PrayerCard prayer={item} onPress={open} />}
        />
      ) : (
        <View style={{ paddingHorizontal: t.space.md }}>
          <Card style={{ gap: 10 }}>
            {profile?.prayer_request ? (
              <AppText variant="callout" numberOfLines={3}>
                <AppText variant="callout" tone="gold">
                  Your pinned prayer:{' '}
                </AppText>
                {profile.prayer_request}
              </AppText>
            ) : (
              <AppText variant="callout" tone="muted">
                Carry each other’s burdens. Share a prayer request and let your community pray with you.
              </AppText>
            )}
            <Button title="Share a prayer" variant="secondary" size="sm" icon="add" onPress={open} style={{ alignSelf: 'flex-start' }} />
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8, borderWidth: 1, minHeight: 140 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  skelRow: { flexDirection: 'row', gap: 12 },
});
