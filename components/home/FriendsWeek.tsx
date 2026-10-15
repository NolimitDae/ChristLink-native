import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFriendsThisWeek } from '../../lib/features';
import { firstName } from '../../lib/format';
import type { FriendActivity } from '../../lib/types';
import { AppText, AvatarStack, SectionHeader } from '../ui';

function namesLabel(a: FriendActivity): string {
  const first = firstName(a.friends[0]?.full_name) || 'A friend';
  const more = a.friends.length - 1;
  if (more <= 0) return first;
  return `${first} + ${more} ${more === 1 ? 'friend' : 'friends'}`;
}

export function FriendsWeek({ refreshKey }: { refreshKey: number }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<FriendActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setItems([]);
      return;
    }
    getFriendsThisWeek()
      .then(list => {
        if (!cancelled) setItems(list.filter(a => a.friends.length > 0).slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader title="What friends are doing this week" />
      <View
        style={[
          styles.group,
          { marginHorizontal: t.space.md, backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg },
        ]}
      >
        {items.map((a, i) => {
          const day = new Date(a.start_date).toLocaleDateString('en-US', { weekday: 'short' });
          const names = namesLabel(a);
          return (
            <Pressable
              key={a.event_id}
              onPress={() => router.push(`/event/${a.event_id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${names} going to ${a.event_name}, ${day}`}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: t.c.border, borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AvatarStack people={a.friends} max={3} size={28} />
              <AppText variant="callout" numberOfLines={2} style={{ flex: 1 }}>
                <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
                  {names}
                </AppText>
                <AppText variant="callout" tone="muted">
                  {' → '}
                  {a.event_name}, {day}
                </AppText>
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
});
