import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getFollowersOf, getFollowingOf } from '../lib/api';
import type { PersonSummary } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { AppText, EmptyState, ListSkeleton, PressScale, Screen, Segmented } from '../components/ui';
import { LoadError } from '../components/LoadError';
import { loadFailure, type LoadFailure } from '../lib/loadFailure';

type Tab = 'followers' | 'following';
type Person = PersonSummary & { city?: string | null };

/** Followers / Following of a profile, opened from the numbers on it. `/connections?userId=…&tab=followers&name=…` */
export default function ConnectionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ userId: string; tab?: string; name?: string }>();
  const userId = params.userId;
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const [people, setPeople] = useState<Record<Tab, Person[] | null>>({ followers: null, following: null });
  const [failed, setFailed] = useState<LoadFailure | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMe = !!user && user.id === userId;
  const first = (params.name ?? '').trim().split(/\s+/)[0];

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // Both lists at once, so switching tabs is instant
      const [followers, following] = await Promise.all([getFollowersOf(userId), getFollowingOf(userId)]);
      setPeople({ followers, following });
      setFailed(null);
    } catch (err) {
      setFailed(loadFailure(err));
      setPeople(p => ({ followers: p.followers ?? [], following: p.following ?? [] }));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const list = people[tab];
  const open = (p: Person) => router.push(user && p.id === user.id ? '/(tabs)/profile' : `/user/${p.id}`);

  const empty = failed ? (
    <LoadError failure={failed} what="this list" art="people" onRetry={load} compact />
  ) : tab === 'followers' ? (
    <EmptyState
      art="people"
      title="No followers yet"
      body={isMe ? 'When people follow you, they show up here.' : `Be the first to follow ${first || 'them'}.`}
      actionLabel={isMe ? 'Find people in Community' : 'Back to profile'}
      onAction={() => (isMe ? router.push('/(tabs)/community') : router.back())}
      compact
    />
  ) : (
    <EmptyState
      art="people"
      title="Not following anyone yet"
      body={isMe ? 'Follow people to see where they’re going and pray with them.' : `${first || 'They'} isn’t following anyone yet.`}
      actionLabel={isMe ? 'Find people in Community' : 'Back to profile'}
      onAction={() => (isMe ? router.push('/(tabs)/community') : router.back())}
      compact
    />
  );

  return (
    <Screen back title={isMe ? 'Your connections' : params.name || 'Connections'}>
      <View style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.sm }}>
        <Segmented<Tab>
          options={[
            { value: 'followers', label: `Followers${people.followers ? ` · ${people.followers.length}` : ''}` },
            { value: 'following', label: `Following${people.following ? ` · ${people.following.length}` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {list === null ? (
        <ListSkeleton rows={6} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: 48, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.border, marginLeft: 56 }} />}
          ListEmptyComponent={empty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={t.c.gold}
              colors={[t.c.gold]}
            />
          }
          renderItem={({ item }) => (
            <PressScale
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.full_name || 'Member'}${item.city ? `, ${item.city}` : ''}. View profile`}
              scaleTo={0.98}
              style={styles.row}
            >
              <Avatar uri={item.avatar_url} name={item.full_name} color={item.avatar_color} size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.full_name || 'Member'}
                </AppText>
                {item.city ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {item.city}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
            </PressScale>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
});
