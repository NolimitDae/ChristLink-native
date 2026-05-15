import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/constants';
import type { Event } from '../lib/types';

interface EventCardProps {
  event: Event;
  variant?: 'horizontal' | 'grid';
}

const C = COLORS.dark;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const GRID_WIDTH = (SCREEN_WIDTH - 48) / 2;

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPrice(event: Event): string {
  if (!event.is_paid) return 'Free';
  if (event.ticket_types && event.ticket_types.length > 0) {
    const minPrice = Math.min(...event.ticket_types.map(tt => tt.price_cents));
    return `$${(minPrice / 100).toFixed(0)}+`;
  }
  return 'Paid';
}

export function EventCard({ event, variant = 'horizontal' }: EventCardProps) {
  const router = useRouter();
  const cardWidth = variant === 'horizontal' ? CARD_WIDTH : GRID_WIDTH;
  const imageHeight = variant === 'horizontal' ? 160 : 120;

  const handlePress = () => {
    router.push(`/event/${event.id}`);
  };

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Cover Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {event.cover_url ? (
          <Image
            source={{ uri: event.cover_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderEmoji}>{event.emoji || '✝️'}</Text>
          </View>
        )}
        {/* Type Badge */}
        {event.event_type ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{event.event_type}</Text>
          </View>
        ) : null}
        {/* Price Badge */}
        <View style={[styles.priceBadge, event.is_paid ? styles.priceBadgePaid : styles.priceBadgeFree]}>
          <Text style={styles.priceBadgeText}>{formatPrice(event)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {event.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={12} color={C.muted} />
          <Text style={styles.metaText}>{formatDate(event.start_date)}</Text>
        </View>
        {event.city ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={12} color={C.muted} />
            <Text style={styles.metaText}>{event.city}</Text>
          </View>
        ) : null}
        {(event.going_count ?? 0) > 0 ? (
          <View style={styles.meta}>
            <Ionicons name="people-outline" size={12} color={C.gold} />
            <Text style={[styles.metaText, { color: C.gold }]}>
              {event.going_count} going
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: C.surface2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface2,
  },
  imagePlaceholderEmoji: {
    fontSize: 36,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceBadgeFree: {
    backgroundColor: C.green,
  },
  priceBadgePaid: {
    backgroundColor: C.gold,
  },
  priceBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: 12,
    gap: 4,
  },
  name: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: C.muted,
    fontSize: 12,
  },
});
