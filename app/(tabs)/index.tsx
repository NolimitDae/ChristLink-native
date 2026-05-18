import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { EventCard } from '../../components/EventCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getEvents } from '../../lib/api';
import { COLORS, EVENT_TYPES } from '../../lib/constants';
import { logger } from '../../lib/logger';
import type { Event as EventModel } from '../../lib/types';

const C = COLORS.dark;

type CategoryType = (typeof EVENT_TYPES)[number];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [events, setEvents] = useState<EventModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [locationEvents, setLocationEvents] = useState<EventModel[] | null>(null);

  const fetchEvents = useCallback(async (category?: CategoryType) => {
    try {
      const cat = category ?? selectedCategory;
      const res = await getEvents({
        type: cat === 'All' ? undefined : cat,
        limit: 50,
      });
      setEvents(res.events);
    } catch (err) {
      logger.error('Failed to fetch events', { error: String(err) });
    }
  }, [selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchEvents().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (category: CategoryType) => {
    setSelectedCategory(category);
    setLocationEvents(null);
    setLoading(true);
    getEvents({ type: category === 'All' ? undefined : category, limit: 50 })
      .then(res => setEvents(res.events))
      .catch((err: unknown) => logger.error('Category change failed', { error: String(err) }))
      .finally(() => setLoading(false));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLocationEvents(null);
    await fetchEvents(selectedCategory);
    setRefreshing(false);
  };

  const handleNearMe = async () => {
    setNearMeLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Access', 'Please enable location access to find events near you.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await getEvents({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        radius: 50,
        limit: 50,
      });
      setLocationEvents(res.events);
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setNearMeLoading(false);
    }
  };

  const displayedEvents = locationEvents ?? events;
  const filteredEvents = search.trim()
    ? displayedEvents.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.city?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (e.event_type?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : displayedEvents;

  const upcomingEvents = filteredEvents.slice(0, 10);
  const trendingEvents = [...filteredEvents]
    .sort((a, b) => (b.going_count ?? 0) - (a.going_count ?? 0))
    .slice(0, 10);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>ChristLink</Text>
        <Text style={styles.tagline}>Faith Events Near You</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.gold}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Ionicons name="search-outline" size={18} color={C.muted} />
            <TextInput
              style={styles.searchText}
              placeholder="Search events, cities, types..."
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
          <TouchableOpacity
            style={[styles.nearMeBtn, nearMeLoading && styles.nearMeBtnDisabled]}
            onPress={handleNearMe}
            disabled={nearMeLoading}
          >
            <Ionicons
              name="location"
              size={16}
              color={locationEvents ? C.gold : C.muted}
            />
          </TouchableOpacity>
        </View>

        {locationEvents ? (
          <TouchableOpacity onPress={() => setLocationEvents(null)} style={styles.nearMeBanner}>
            <Ionicons name="location" size={14} color={C.gold} />
            <Text style={styles.nearMeBannerText}>
              Showing {locationEvents.length} events near you
            </Text>
            <Text style={styles.nearMeBannerClear}>Clear</Text>
          </TouchableOpacity>
        ) : null}

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categories}
          contentContainerStyle={styles.categoriesContent}
        >
          {EVENT_TYPES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, selectedCategory === cat && styles.pillActive]}
              onPress={() => handleCategoryChange(cat)}
            >
              <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <LoadingSpinner message="Loading events..." />
        ) : (
          <>
            {/* Upcoming Events */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {upcomingEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🙏</Text>
                  <Text style={styles.emptyText}>No events found</Text>
                  <Text style={styles.emptySubtext}>Try a different category or location</Text>
                </View>
              ) : (
                <FlatList
                  data={upcomingEvents}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                  renderItem={({ item }) => <EventCard event={item} variant="horizontal" />}
                  contentContainerStyle={styles.horizontalList}
                  scrollEnabled
                />
              )}
            </View>

            {/* Trending This Week */}
            {trendingEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trending This Week</Text>
                <FlatList
                  data={trendingEvents}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                  renderItem={({ item }) => <EventCard event={item} variant="horizontal" />}
                  contentContainerStyle={styles.horizontalList}
                  scrollEnabled
                />
              </View>
            )}
          </>
        )}
        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  logo: {
    color: C.gold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: C.muted,
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
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
  nearMeBtn: {
    width: 44,
    height: 44,
    backgroundColor: C.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  nearMeBtnDisabled: {
    opacity: 0.5,
  },
  nearMeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.goldDim ?? 'rgba(201,168,76,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nearMeBannerText: {
    flex: 1,
    color: C.gold,
    fontSize: 13,
    fontWeight: '500',
  },
  nearMeBannerClear: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  categories: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: C.goldDim ?? 'rgba(201,168,76,0.15)',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: C.muted,
    fontSize: 14,
  },
});
