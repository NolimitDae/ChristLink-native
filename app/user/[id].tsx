import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { followUser, getEvents, getPublicProfile, unfollowUser } from '../../lib/api';
import { unblockUser } from '../../lib/features';
import { haptic } from '../../lib/haptics';
import type { Event, Profile } from '../../lib/types';
import { EventCard } from '../../components/EventCard';
import { useReport } from '../../components/ReportSheet';
import { useShareCard } from '../../components/ShareCard';
import { Avatar } from '../../components/Avatar';
import {
  AppText,
  Button,
  EmptyState,
  EventCardSkeleton,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
} from '../../components/ui';
import { ProfileHero } from '../../components/profile/ProfileHero';
import { StatsRow } from '../../components/profile/StatsRow';
import { PinnedPrayerCard, ProfileVerseCard } from '../../components/profile/VerseCard';

export default function PublicProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { blockedIds, refreshBlocked } = useAppData();
  const { showToast } = useToast();
  const report = useReport();
  const { open: openShare, sheet: shareSheet } = useShareCard();
  const token = session?.access_token;
  const isMe = !!session && session.user.id === id;
  const blocked = !!id && blockedIds.has(id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isMe) router.replace('/profile');
  }, [isMe, router]);

  const load = useCallback(async () => {
    if (!id || isMe) return;
    try {
      const p = await getPublicProfile(id, token);
      setProfile(p);
      setFollowing(!!p.is_following);
      setFollowers(p.followers_count ?? 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    try {
      const res = await getEvents({ host_id: id });
      setEvents(res.events.filter(e => e.host_id === id));
    } catch {
      setEvents([]);
    }
  }, [id, isMe, token]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleFollow = async () => {
    if (!token || !id) {
      router.push('/auth');
      return;
    }
    const next = !following;
    haptic.light();
    setFollowing(next);
    setFollowers(n => Math.max(0, n + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = next ? await followUser(id, token) : await unfollowUser(id, token);
      if (typeof res.following === 'boolean' && res.following !== next) {
        setFollowing(res.following);
        setFollowers(n => Math.max(0, n + (res.following ? 1 : -1)));
      }
    } catch (err) {
      setFollowing(!next);
      setFollowers(n => Math.max(0, n + (next ? -1 : 1)));
      showToast(err instanceof Error ? err.message : 'Could not update follow', 'error');
    } finally {
      setBusy(false);
    }
  };

  const unblock = async () => {
    if (!id) return;
    try {
      await unblockUser(id);
      await refreshBlocked();
      showToast('Unblocked', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not unblock', 'error');
    }
  };

  const menu = profile ? (
    <IconButton
      icon="ellipsis-horizontal"
      label="Report or block"
      onPress={() => report.open({ type: 'profile', id: profile.id, authorId: profile.id, authorName: profile.full_name })}
    />
  ) : null;

  if (isMe) return <Screen back title=""><View /></Screen>;

  if (failed && !profile) {
    return (
      <Screen back title="Profile">
        <EmptyState art="people" title="Profile unavailable" body="This profile couldn't be loaded. It may have been removed." actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen back title="">
        <SkeletonGroup label="Loading profile">
          <View style={{ paddingHorizontal: t.space.md, gap: t.space.md }}>
            <Skeleton height={150} radius={t.radius.lg} />
            <Skeleton width={96} height={96} radius={48} style={{ marginTop: -60, marginLeft: t.space.sm }} />
            <Skeleton width="60%" height={24} />
            <Skeleton width="85%" height={14} />
          </View>
        </SkeletonGroup>
      </Screen>
    );
  }

  if (blocked || profile.restricted) {
    return (
      <Screen back title="" right={blocked ? null : menu}>
        <View style={{ alignItems: 'center', paddingTop: t.space.xl, gap: t.space.sm }}>
          <Avatar name={profile.full_name} color={profile.avatar_color} uri={blocked ? null : profile.avatar_url} size={80} />
          <AppText variant="title2">{profile.full_name}</AppText>
        </View>
        {blocked ? (
          <EmptyState
            compact
            art="people"
            title="You blocked this account"
            body="You won't see their posts, prayers or messages. They aren't notified."
            actionLabel="Unblock"
            onAction={unblock}
          />
        ) : (
          <EmptyState compact art="people" title="This profile is limited" body="Some details are hidden for this account." />
        )}
        {report.sheet}
      </Screen>
    );
  }

  return (
    <Screen back title="" right={menu}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <ProfileHero
          profile={profile}
          right={
            <Button
              title={following ? 'Following' : 'Follow'}
              icon={following ? 'checkmark' : 'person-add-outline'}
              variant={following ? 'secondary' : 'primary'}
              size="sm"
              onPress={toggleFollow}
              disabled={busy}
              accessibilityHint={following ? 'Double tap to unfollow' : undefined}
            />
          }
        />

        <StatsRow
          stats={[
            { label: 'Followers', value: String(followers) },
            { label: 'Following', value: String(profile.following_count ?? 0) },
          ]}
        />

        {profile.bible_verse ? (
          <ProfileVerseCard
            verse={profile.bible_verse}
            reference={profile.bible_verse_reference}
            onShare={() => openShare({ kind: 'verse', text: profile.bible_verse ?? '', reference: profile.bible_verse_reference ?? '' })}
          />
        ) : null}

        {profile.prayer_request ? <PinnedPrayerCard text={profile.prayer_request} /> : null}

        <View>
          <SectionHeader title="Upcoming events" />
          <View style={{ paddingHorizontal: t.space.md, gap: t.space.sm }}>
            {events === null ? (
              <EventCardSkeleton variant="row" />
            ) : events.length === 0 ? (
              <EmptyState compact art="calendar" title="No upcoming events" body={`${profile.full_name.split(' ')[0] || 'They'} isn't hosting anything right now.`} />
            ) : (
              events.map(e => <EventCard key={e.id} event={e} variant="row" />)
            )}
          </View>
        </View>
      </ScrollView>
      {report.sheet}
      {shareSheet}
    </Screen>
  );
}
