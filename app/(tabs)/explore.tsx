import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from '../../components/EventCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getEvents } from '../../lib/api';
import { COLORS, EVENT_TYPES } from '../../lib/constants';
import { logger } from '../../lib/logger';
import type { Event } from '../../lib/types';

const C = COLORS.dark;

type CategoryType = (typeof EVENT_TYPES)[number];
type FormatFilter = 'all' | 'in_person' | 'online' | 'hybrid';
type PriceFilter = 'all' | 'free' | 'paid';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<CategoryType>('All');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;

  const buildParams = useCallback(() => ({
    type: selectedType === 'All' ? undefined : selectedType,
    format: formatFilter === 'all' ? undefined : formatFilter,
    is_paid: priceFilter === 'all' ? undefined : priceFilter === 'paid',
    q: search.trim() || undefined,
    limit: LIMIT,
    offset: 0,
  }), [selectedType, formatFilter, priceFilter, search]);

  const fetchEvents = useCallback(async (_reset = false) => {
    try {
      const params = buildParams();
      const res = await getEvents(params);
      setEvents(res.events);
      setOffset(res.events.length);
      setHasMore(res.events.length === LIMIT);
    } catch (err) {
      logger.error('Explore fetch error', { error: String(err) });
    }
  }, [buildParams]);

  useEffect(() => {
    setLoading(true);
    fetchEvents(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, formatFilter, priceFilter]);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setLoading(true);
      fetchEvents(true).finally(() => setLoading(false));
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents(true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = { ...buildParams(), offset };
      const res = await getEvents(params);
      setEvents(prev => [...prev, ...res.events]);
      setOffset(prev => prev + res.events.length);
      setHasMore(res.events.length === LIMIT);
    } catch (err) {
      logger.error('Load more error', { error: String(err) });
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Event; index: number }) => (
      <View style={index % 2 === 0 ? styles.cardLeft : styles.cardRight}>
        <EventCard event={item} variant="grid" />
      </View>
    ),
    [],
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 24 }} />;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Events</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            style={styles.searchText}
            placeholder="Search events..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type Filter */}
      <FlatList
        data={EVENT_TYPES}
        keyExtractor={item => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typePills}
        contentContainerStyle={styles.typePillsContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.pill, selectedType === item && styles.pillActive]}
            onPress={() => setSelectedType(item)}
          >
            <Text style={[styles.pillText, selectedType === item && styles.pillTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Format + Price Filter */}
      <View style={styles.filterRow}>
        {(['all', 'in_person', 'online', 'hybrid'] as FormatFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, formatFilter === f && styles.filterChipActive]}
            onPress={() => setFormatFilter(f)}
          >
            <Text style={[styles.filterChipText, formatFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All Formats' : f === 'in_person' ? 'In Person' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterSeparator} />
        {(['all', 'free', 'paid'] as PriceFilter[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.filterChip, priceFilter === p && styles.filterChipActive]}
            onPress={() => setPriceFilter(p)}
          >
            <Text style={[styles.filterChipText, priceFilter === p && styles.filterChipTextActive]}>
              {p === 'all' ? 'Any Price' : p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results count */}
      {!loading && (
        <Text style={styles.resultsCount}>
          {events.length} {events.length === 1 ? 'event' : 'events'} found
        </Text>
      )}

      {/* Event Grid */}
      {loading ? (
        <LoadingSpinner message="Searching events..." />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>No events found</Text>
          <Text style={styles.emptySubtext}>Try different filters or search terms</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.gold} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  headerTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchText: {
    flex: 1,
    color: C.text,
    fontSize: 15,
  },
  typePills: {
    marginBottom: 8,
  },
  typePillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: C.gold,
  },
  pillText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: C.gold,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  filterSeparator: {
    width: 1,
    height: 18,
    backgroundColor: C.border,
    marginHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: C.gold,
  },
  filterChipText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: C.gold,
    fontWeight: '700',
  },
  resultsCount: {
    color: C.muted,
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cardLeft: {
    flex: 1,
    marginRight: 8,
    marginBottom: 12,
  },
  cardRight: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 12,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    color: C.muted,
    fontSize: 14,
  },
});
