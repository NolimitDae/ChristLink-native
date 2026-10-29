import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFriendsGoing } from '../../hooks/useFriendsGoing';
import { useShareCard } from '../../components/ShareCard';
import { EmptyState, SectionHeader } from '../../components/ui';
import { HomeHeader } from '../../components/home/HomeHeader';
import { VerseCard } from '../../components/home/VerseCard';
import { WeekStrip } from '../../components/home/WeekStrip';
import { TonightCarousel } from '../../components/home/TonightCarousel';
import { HomeChurchCard } from '../../components/home/HomeChurchCard';
import { PrayerRow } from '../../components/home/PrayerRow';
import { FriendsWeek } from '../../components/home/FriendsWeek';
import { CategoryRail } from '../../components/home/CategoryRail';
import { EventsSkeleton, WeekStripSkeleton } from '../../components/home/HomeSkeleton';
import { useHomeData } from '../../components/home/useHomeData';
import { getVerseOfTheDay } from '../../lib/features';
import { EVENT_TYPES, type EventType } from '../../lib/constants';
import { isTonight } from '../../lib/format';
import type { Verse } from '../../lib/verses';
import type { Event } from '../../lib/types';
import { useTabBarClearance } from '../../components/TabBar';

const HOUR = 3_600_000;
const MAX_CATEGORY_RAILS = 6;

function startMs(e: Event): number {
  return e.start_date ? new Date(e.start_date).getTime() : Number.MAX_SAFE_INTEGER;
}

export default function HomeScreen() {
  const t = useTheme();
  const barClearance = useTabBarClearance();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const share = useShareCard();
  const { events, error, plans, plansLoaded, churchEventIds, homeChurchId, refreshing, refreshKey, refresh, retry } = useHomeData();
  const [verse, setVerse] = useState<Verse | null>(null);

  const eventsById = useMemo(() => new Map((events ?? []).map(e => [e.id, e])), [events]);

  const verseTheme = useMemo(() => {
    const now = Date.now() - 2 * HOUR;
    const next = [...plans].filter(p => new Date(p.start).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
    return (next && eventsById.get(next.eventId)?.event_type) || null;
  }, [plans, eventsById]);

  const verseReady = plansLoaded && (events !== null || error !== null);

  useEffect(() => {
    if (!verseReady) return;
    let cancelled = false;
    getVerseOfTheDay(verseTheme).then(v => {
      if (!cancelled) setVerse(v);
    });
    return () => {
      cancelled = true;
    };
  }, [verseReady, verseTheme]);

  const sections = useMemo(() => {
    const now = Date.now();
    const churchSet = new Set(churchEventIds);
    const upcoming = (events ?? []).filter(e => !e.start_date || startMs(e) > now - 2 * HOUR);
    const rank = (list: Event[]) =>
      [...list].sort((a, b) => Number(churchSet.has(b.id)) - Number(churchSet.has(a.id)) || startMs(a) - startMs(b));

    const tonight = upcoming.filter(e => isTonight(e.start_date));
    const soon = tonight.length > 0 ? tonight : upcoming.filter(e => e.start_date && startMs(e) >= now && startMs(e) <= now + 24 * HOUR);

    const categories: { type: EventType; events: Event[] }[] = EVENT_TYPES.filter(type => type !== 'All')
      .map(type => ({ type, events: rank(upcoming.filter(e => (e.event_type ?? '').toLowerCase() === type.toLowerCase())) }))
      .filter(s => s.events.length > 0)
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, MAX_CATEGORY_RAILS);
    if (categories.length === 0 && upcoming.length > 0) categories.push({ type: 'All', events: rank(upcoming) });

    const nextChurchEvent = upcoming.filter(e => churchSet.has(e.id) && e.start_date).sort((a, b) => startMs(a) - startMs(b))[0] ?? null;

    return { upcoming, soon: rank(soon), tonightIsReal: tonight.length > 0, categories, nextChurchEvent };
  }, [events, churchEventIds]);

  const friends = useFriendsGoing(useMemo(() => sections.upcoming.map(e => e.id), [sections.upcoming]));

  const loading = events === null && !error;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + t.space.sm, paddingBottom: barClearance + t.space.md, gap: t.space.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <HomeHeader />

        <View style={{ paddingHorizontal: t.space.md }}>
          <VerseCard
            verse={verse}
            theme={verseTheme}
            onShare={v => share.open({ kind: 'verse', reference: v.reference, text: v.text })}
          />
        </View>

        <View>
          <SectionHeader title="Your week" />
          {session && !plansLoaded ? <WeekStripSkeleton /> : <WeekStrip plans={plans} signedIn={!!session} />}
        </View>

        {loading ? (
          <EventsSkeleton />
        ) : events === null ? (
          <EmptyState art="offline" title="We couldn’t load events" body={error ?? undefined} actionLabel="Try again" onAction={retry} compact />
        ) : sections.soon.length > 0 ? (
          <TonightCarousel
            title={sections.tonightIsReal ? 'Happening tonight' : 'In the next 24 hours'}
            eyebrow={sections.tonightIsReal ? 'Tonight' : 'Soon'}
            events={sections.soon}
            friends={friends}
          />
        ) : null}

        <View style={{ paddingHorizontal: t.space.md }}>
          <HomeChurchCard churchId={homeChurchId} nextEvent={sections.nextChurchEvent} refreshKey={refreshKey} />
        </View>

        <PrayerRow refreshKey={refreshKey} />

        <FriendsWeek refreshKey={refreshKey} />

        {events !== null && sections.upcoming.length === 0 ? (
          <EmptyState
            art="calendar"
            title="No upcoming events yet"
            body="New gatherings appear here as hosts publish them. Have something in mind?"
            actionLabel="Host an event"
            onAction={() => router.push('/(tabs)/host')}
          />
        ) : (
          sections.categories.map(s => (
            <CategoryRail
              key={s.type}
              title={s.type === 'All' ? 'Coming up' : s.type}
              events={s.events}
              friends={friends}
              onSeeAll={() =>
                router.push(s.type === 'All' ? '/explore?tab=events' : `/explore?tab=events&type=${encodeURIComponent(s.type)}`)
              }
            />
          ))
        )}
      </ScrollView>
      {share.sheet}
    </View>
  );
}
