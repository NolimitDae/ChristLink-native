import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getEvent, getMyEvents, updateProfile, uploadAvatar, uploadBanner } from '../../lib/api';
import { getChurch, getHoursServed } from '../../lib/features';
import { logger } from '../../lib/logger';
import type { Event } from '../../lib/types';
import { EventCard } from '../../components/EventCard';
import { useShareCard } from '../../components/ShareCard';
import { Button, EmptyState, EventCardSkeleton, ListGroup, ListRow, Screen, Segmented } from '../../components/ui';
import { EditProfileSheet } from '../../components/profile/EditProfileSheet';
import { ProfileHero } from '../../components/profile/ProfileHero';
import { StatsRow } from '../../components/profile/StatsRow';
import { PinnedPrayerCard, ProfileVerseCard } from '../../components/profile/VerseCard';
import { pickImageDataUrl } from '../../components/profile/pickImage';

type Tab = 'saved' | 'hosting';

function formatHours(h: number): string {
  if (h <= 0) return '0';
  return h < 10 ? String(Math.round(h * 10) / 10) : String(Math.round(h));
}

export default function MyProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { savedIds, settings } = useAppData();
  const { showToast } = useToast();
  const { open: openShare, sheet: shareSheet } = useShareCard();
  const token = session?.access_token;

  const [tab, setTab] = useState<Tab>('saved');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState<'banner' | 'avatar' | null>(null);
  const [hours, setHours] = useState(0);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [saved, setSaved] = useState<Event[] | null>(null);
  const [hosted, setHosted] = useState<Event[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSaved = useCallback(async () => {
    const ids = [...savedIds];
    const results = await Promise.allSettled(ids.map(id => getEvent(id, token)));
    setSaved(results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])));
  }, [savedIds, token]);

  const loadHosted = useCallback(async () => {
    if (!token) return;
    try {
      setHosted((await getMyEvents(token)).events);
    } catch (err) {
      logger.warn('My events not loaded', { error: String(err) });
      setHosted([]);
    }
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    await Promise.all([loadSaved(), loadHosted(), getHoursServed().then(setHours)]);
  }, [token, loadSaved, loadHosted]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = settings?.home_church_id;
    if (!id) {
      setChurchName(null);
      return;
    }
    getChurch(id)
      .then(c => setChurchName(c?.name ?? null))
      .catch(() => setChurchName(null));
  }, [settings?.home_church_id]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), refreshProfile()]);
    setRefreshing(false);
  };

  const pick = async (kind: 'banner' | 'avatar') => {
    if (!token) return;
    try {
      const dataUrl = await pickImageDataUrl(kind === 'banner' ? [3, 1] : [1, 1]);
      if (!dataUrl) return;
      setUploading(kind);
      const { url } = kind === 'banner' ? await uploadBanner(dataUrl, token) : await uploadAvatar(dataUrl, token);
      await updateProfile(kind === 'banner' ? { banner_url: url } : { avatar_url: url }, token);
      await refreshProfile();
      showToast(kind === 'banner' ? 'Banner updated' : 'Photo updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  if (!session || !token) {
    return (
      <Screen title="Profile">
        <EmptyState
          art="people"
          title="Your profile lives here"
          body="Sign in to save events, follow friends and share prayers."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      </Screen>
    );
  }

  const isHost = (hosted?.length ?? 0) > 0;
  const list = tab === 'saved' ? saved : hosted;

  return (
    <Screen title="Profile">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        {profile ? (
          <ProfileHero profile={profile} editable onPickBanner={() => pick('banner')} onPickAvatar={() => pick('avatar')} uploading={uploading} />
        ) : (
          <EventCardSkeleton variant="row" />
        )}

        <View style={{ flexDirection: 'row', gap: t.space.xs, paddingHorizontal: t.space.md }}>
          <Button title="Edit profile" icon="create-outline" variant="secondary" size="sm" onPress={() => setEditing(true)} style={{ flex: 1 }} fullWidth />
          <Button title="Settings" icon="settings-outline" variant="secondary" size="sm" onPress={() => router.push('/settings')} style={{ flex: 1 }} fullWidth />
        </View>
        <View style={{ paddingHorizontal: t.space.md }}>
          <Button
            title={isHost ? 'Host dashboard' : 'Host an event'}
            icon={isHost ? 'stats-chart-outline' : 'add-circle-outline'}
            size="sm"
            onPress={() => router.push('/(tabs)/host')}
            fullWidth
          />
        </View>

        <StatsRow
          stats={[
            { label: 'Followers', value: String(profile?.followers_count ?? 0) },
            { label: 'Following', value: String(profile?.following_count ?? 0) },
            { label: 'Events hosted', value: String(hosted?.length ?? 0), onPress: isHost ? () => setTab('hosting') : undefined },
            { label: 'Hours served', value: formatHours(hours), hint: 'Only you can see this', onPress: () => router.push('/serve') },
          ]}
        />

        {profile?.bible_verse ? (
          <ProfileVerseCard
            verse={profile.bible_verse}
            reference={profile.bible_verse_reference}
            onShare={() => openShare({ kind: 'verse', text: profile.bible_verse ?? '', reference: profile.bible_verse_reference ?? '' })}
          />
        ) : null}

        {profile?.prayer_request ? <PinnedPrayerCard text={profile.prayer_request} /> : null}

        <View style={{ paddingHorizontal: t.space.md }}>
          <ListGroup title="Home Church">
            {settings?.home_church_id ? (
              <ListRow
                icon="business-outline"
                title={churchName ?? 'Your Home Church'}
                subtitle="Your church family"
                onPress={() => router.push(`/church/${settings.home_church_id}`)}
                last
              />
            ) : (
              <ListRow
                icon="business-outline"
                title="Choose your Home Church"
                subtitle="See services, prayers and serve shifts from your church"
                onPress={() => router.push('/explore?tab=churches')}
                last
              />
            )}
          </ListGroup>
        </View>

        <View style={{ paddingHorizontal: t.space.md }}>
          <Segmented
            options={[
              { value: 'saved', label: `Saved${saved ? ` · ${saved.length}` : ''}` },
              { value: 'hosting', label: `My hosted events${hosted ? ` · ${hosted.length}` : ''}` },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        <View style={{ paddingHorizontal: t.space.md, gap: t.space.sm }}>
          {list === null ? (
            <>
              <EventCardSkeleton variant="row" />
              <EventCardSkeleton variant="row" />
            </>
          ) : list.length === 0 ? (
            tab === 'saved' ? (
              <EmptyState
                compact
                art="calendar"
                title="No saved events yet"
                body="Tap the heart on any event to keep it here."
                actionLabel="Explore events"
                onAction={() => router.push('/explore')}
              />
            ) : (
              <EmptyState
                compact
                art="ticket"
                title="You haven't hosted yet"
                body="Gather your community for worship, study or service."
                actionLabel="Host an event"
                onAction={() => router.push('/event/create')}
              />
            )
          ) : (
            list.map(e => <EventCard key={e.id} event={e} variant="row" />)
          )}
        </View>
      </ScrollView>

      <EditProfileSheet visible={editing} onClose={() => setEditing(false)} profile={profile} token={token} onSaved={refreshProfile} />
      {shareSheet}
    </Screen>
  );
}
