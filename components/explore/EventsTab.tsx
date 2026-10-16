import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useFriendsGoing } from '../../hooks/useFriendsGoing';
import { getEvents, type GetEventsParams } from '../../lib/api';
import { EVENT_TYPES, type EventType } from '../../lib/constants';
import { isWithinDays } from '../../lib/format';
import type { Event } from '../../lib/types';
import { EventCard } from '../EventCard';
import { Chip, ChipRow, EmptyState, Field, ListSkeleton } from '../ui';
import { errorMessage } from '../church/churchFormat';
import { useUserLocation, type Coords } from './useUserLocation';

type Price = 'any' | 'free' | 'paid';

function Separator() {
  return <View style={{ height: 12 }} />;
}

function toEventType(v?: string): EventType {
  const match = EVENT_TYPES.find(x => x.toLowerCase() === (v ?? '').toLowerCase());
  return match ?? 'All';
}

export function EventsTab({ initialType, bottomInset }: { initialType?: string; bottomInset: number }) {
  const t = useTheme();
  const location = useUserLocation('Turn on location to see worship nights, studies and gatherings within about 50 miles of you.');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<EventType>(toEventType(initialType));
  const [price, setPrice] = useState<Price>('any');
  const [online, setOnline] = useState(false);
  const [thisWeek, setThisWeek] = useState(false);
  const [near, setNear] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initialType) setCategory(toEventType(initialType));
  }, [initialType]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params: GetEventsParams = {
      q: debounced || undefined,
      type: category === 'All' ? undefined : category,
      is_paid: price === 'any' ? undefined : price === 'paid',
      format: online ? 'online' : undefined,
      limit: 60,
      signal: controller.signal,
      ...(near ? { lat: near.lat, lng: near.lng, radius: 50 } : {}),
    };
    setError(null);
    getEvents(params)
      .then(res => {
        setEvents(res.events);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, 'Could not load events.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [debounced, category, price, online, near, reloadKey]);

  const visible = useMemo(
    () => (events ?? []).filter(e => !thisWeek || isWithinDays(e.start_date, 7)),
    [events, thisWeek],
  );
  const friends = useFriendsGoing(useMemo(() => visible.map(e => e.id), [visible]));

  const toggleNear = useCallback(async () => {
    if (near) {
      setNear(null);
      return;
    }
    setLocating(true);
    const c = await location.request();
    setLocating(false);
    if (c) setNear(c);
  }, [near, location]);

  const filtersActive = !!debounced || category !== 'All' || price !== 'any' || online || thisWeek || !!near;
  const clearAll = () => {
    setQuery('');
    setCategory('All');
    setPrice('any');
    setOnline(false);
    setThisWeek(false);
    setNear(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.sm }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search events, hosts, cities"
          accessibilityLabel="Search events"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          left={<Ionicons name="search" size={18} color={t.c.textFaint} />}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
        <Chip label={locating ? 'Locating…' : 'Near me'} icon="navigate" selected={!!near} onPress={toggleNear} />
        <Chip label="Free" selected={price === 'free'} onPress={() => setPrice(p => (p === 'free' ? 'any' : 'free'))} />
        <Chip label="Paid" selected={price === 'paid'} onPress={() => setPrice(p => (p === 'paid' ? 'any' : 'paid'))} />
        <Chip label="Online" icon="videocam-outline" selected={online} onPress={() => setOnline(v => !v)} />
        <Chip label="This week" icon="calendar-outline" selected={thisWeek} onPress={() => setThisWeek(v => !v)} />
      </ScrollView>
      <View>
        <ChipRow options={EVENT_TYPES} value={category} onChange={setCategory} style={{ paddingBottom: 4 }} />
      </View>

      {events === null && !error ? (
        <ListSkeleton rows={5} />
      ) : error && events === null ? (
        <EmptyState art="offline" title="We couldn’t load events" body={error} actionLabel="Try again" onAction={() => setReloadKey(k => k + 1)} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: t.space.md, paddingBottom: bottomInset, flexGrow: 1 }}
          ItemSeparatorComponent={Separator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setReloadKey(k => k + 1);
              }}
              tintColor={t.c.gold}
              colors={[t.c.gold]}
            />
          }
          renderItem={({ item }: ListRenderItemInfo<Event>) => <EventCard event={item} variant="row" friends={friends[item.id]} />}
          ListEmptyComponent={
            filtersActive ? (
              <EmptyState
                art="search"
                title="No events match"
                body={near ? 'Nothing within 50 miles with these filters yet.' : 'Try a different search or fewer filters.'}
                actionLabel="Clear filters"
                onAction={clearAll}
              />
            ) : (
              <EmptyState art="calendar" title="No upcoming events" body="Check back soon — new gatherings are added every week." />
            )
          }
        />
      )}
      {location.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  filterBar: { flexGrow: 0, marginTop: 12, marginBottom: 8 },
  filters: { gap: 8, paddingHorizontal: 16 },
});
