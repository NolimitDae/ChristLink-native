import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getEvents, getMyEvents } from '../lib/api';
import type { Event } from '../lib/types';
import { EventCard } from '../components/EventCard';
import { AppText, Badge, EmptyState, ListSkeleton, Screen } from '../components/ui';

/**
 * Events someone hosts, opened from "Events hosted" on a profile. Your own list includes drafts and past events
 * (from /api/my-events); someone else's shows their published events.
 */
export default function HostedEventsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, session } = useAuth();
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const userId = params.userId;
  const isMe = !!user && user.id === userId;
  const [events, setEvents] = useState<Event[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const list = isMe && session ? (await getMyEvents(session.access_token)).events : (await getEvents({ host_id: userId })).events;
      // Newest first; your own list keeps drafts at the top
      setEvents(list.filter(e => e.host_id === userId).sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')));
      setFailed(false);
    } catch {
      setFailed(true);
      setEvents([]);
    }
  }, [userId, isMe, session]);

  useEffect(() => {
    load();
  }, [load]);

  const first = (params.name ?? '').trim().split(/\s+/)[0];

  return (
    <Screen back title={isMe ? 'Your events' : `${first || 'Their'}${first ? '’s' : ''} events`}>
      {events === null ? (
        <ListSkeleton rows={5} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: 48, gap: t.space.sm, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              art={failed ? 'offline' : 'calendar'}
              title={failed ? 'Couldn’t load events' : isMe ? 'You haven’t hosted yet' : 'No events yet'}
              body={failed ? 'Check your connection and try again.' : isMe ? 'Worship nights, studies, outreach — create your first event.' : `${first || 'They'} hasn’t published an event yet.`}
              actionLabel={failed ? 'Try again' : isMe ? 'Host an event' : 'Back to profile'}
              onAction={failed ? load : isMe ? () => router.push('/event/create') : () => router.back()}
            />
          }
          renderItem={({ item }) => (
            <View>
              {isMe && item.status !== 'published' ? (
                <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                  <Badge label={item.status ?? 'draft'} tone="neutral" />
                </View>
              ) : null}
              <EventCard event={item} variant="row" onPress={isMe ? () => router.push(`/event/${item.id}`) : undefined} />
            </View>
          )}
          ListHeaderComponent={
            events.length > 0 ? (
              <AppText variant="callout" tone="muted" style={{ marginBottom: t.space.xs }}>
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </AppText>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
