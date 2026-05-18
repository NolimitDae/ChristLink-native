import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { GoldButton } from '../../components/GoldButton';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getEvent, rsvpToEvent, cancelRsvp, getRsvp, getEventAttendees } from '../../lib/api';
import { COLORS } from '../../lib/constants';
import type { Event, Profile } from '../../lib/types';

const C = COLORS.dark;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.56; // 16:9 ratio

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPrice(event: Event): string {
  if (!event.is_paid) return 'Free Event';
  if (event.ticket_types && event.ticket_types.length > 0) {
    const minPrice = Math.min(...event.ticket_types.map(tt => tt.price_cents));
    return `From $${(minPrice / 100).toFixed(2)}`;
  }
  return 'Paid Event';
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const { showToast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRsvp, setHasRsvp] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [eventData, attendeesData] = await Promise.all([
        getEvent(id),
        getEventAttendees(id),
      ]);
      setEvent(eventData);
      setAttendees(attendeesData.attendees.slice(0, 12));

      if (session?.access_token) {
        try {
          const rsvpData = await getRsvp(id, session.access_token);
          setHasRsvp(!!rsvpData.rsvp && rsvpData.rsvp.status === 'confirmed');
        } catch {
          setHasRsvp(false);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load event';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRsvp = async () => {
    if (!session?.access_token) {
      router.push('/auth');
      return;
    }
    if (!event) return;

    setRsvpLoading(true);
    try {
      if (hasRsvp) {
        // Cancel RSVP
        Alert.alert('Cancel RSVP', 'Are you sure you want to cancel your RSVP?', [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Cancel RSVP',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelRsvp(event.id, session.access_token!);
                setHasRsvp(false);
                setEvent(prev =>
                  prev ? { ...prev, rsvp_count: Math.max(0, (prev.rsvp_count ?? 1) - 1) } : prev,
                );
                showToast('RSVP cancelled', 'info');
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to cancel RSVP';
                showToast(message, 'error');
              }
            },
          },
        ]);
        setRsvpLoading(false);
        return;
      }
      // Create RSVP
      await rsvpToEvent(event.id, session.access_token);
      setHasRsvp(true);
      setEvent(prev =>
        prev ? { ...prev, rsvp_count: (prev.rsvp_count ?? 0) + 1 } : prev,
      );
      showToast('You\'re going! 🙌', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to RSVP';
      showToast(message, 'error');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out "${event.name}" on ChristLink!`,
        title: event.name,
      });
    } catch {
      // User cancelled
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading event..." />;
  }

  if (error || !event) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={64} color={C.muted} />
        <Text style={styles.errorTitle}>Event Not Found</Text>
        <Text style={styles.errorSubtext}>{error ?? 'This event could not be loaded.'}</Text>
        <GoldButton title="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const isHost = event.host_id === user?.id;
  const goingCount = event.going_count ?? event.rsvp_count ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Image */}
        <View style={[styles.hero, { height: HERO_HEIGHT }]}>
          {event.cover_url ? (
            <Image source={{ uri: event.cover_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroEmoji}>{event.emoji ?? '✝️'}</Text>
            </View>
          )}
          {/* Gradient overlay */}
          <View style={styles.heroGradient} />

          {/* Back + Share buttons */}
          <View style={[styles.heroNav, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.heroNavBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroNavBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Price badge */}
          <View style={[styles.priceBadge, event.is_paid ? styles.priceBadgePaid : styles.priceBadgeFree]}>
            <Text style={styles.priceBadgeText}>{formatPrice(event)}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Type + Format */}
          <View style={styles.tagRow}>
            {event.event_type ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{event.event_type}</Text>
              </View>
            ) : null}
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {event.format === 'in_person' ? 'In Person' : event.format === 'online' ? 'Online' : 'Hybrid'}
              </Text>
            </View>
            {event.age_group && event.age_group !== 'All Ages' ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{event.age_group}</Text>
              </View>
            ) : null}
          </View>

          {/* Event Name */}
          <Text style={styles.eventName}>{event.name}</Text>

          {/* Host info */}
          <TouchableOpacity style={styles.hostRow} onPress={() => router.push(`/event/${event.id}`)}>
            <Avatar
              uri={event.host_avatar_url}
              name={event.host_name}
              color={event.host_avatar_color}
              size={36}
            />
            <View>
              <Text style={styles.hostedByLabel}>Hosted by</Text>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>{event.host_name ?? 'Unknown Host'}</Text>
                {(event.host_role === 'verified' || event.host_role === 'admin') && (
                  <Ionicons name="checkmark-circle" size={14} color={C.gold} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Details */}
          <View style={styles.details}>
            {/* Date */}
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar" size={20} color={C.gold} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(event.start_date)}</Text>
                {event.start_date ? (
                  <Text style={styles.detailSub}>{formatTime(event.start_date)}
                    {event.end_date ? ` – ${formatTime(event.end_date)}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Location */}
            {(event.format === 'in_person' || event.format === 'hybrid') && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location" size={20} color={C.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Location</Text>
                  {event.venue_name ? (
                    <Text style={styles.detailValue}>{event.venue_name}</Text>
                  ) : null}
                  {event.address ? (
                    <Text style={styles.detailSub}>
                      {event.address}
                      {event.city ? `, ${event.city}` : ''}
                      {event.state ? `, ${event.state}` : ''}
                    </Text>
                  ) : event.city ? (
                    <Text style={styles.detailValue}>{event.city}{event.state ? `, ${event.state}` : ''}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Online URL */}
            {(event.format === 'online' || event.format === 'hybrid') && event.online_url ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="videocam" size={20} color={C.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Online</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{event.online_url}</Text>
                </View>
              </View>
            ) : null}

            {/* Capacity */}
            {goingCount > 0 || event.max_capacity ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="people" size={20} color={C.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Attendance</Text>
                  <Text style={styles.detailValue}>
                    {goingCount} going
                    {event.max_capacity ? ` · ${event.max_capacity} max` : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Event</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          ) : null}

          {/* Ticket Types */}
          {event.is_paid && event.ticket_types && event.ticket_types.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tickets</Text>
              {event.ticket_types.map(tt => (
                <View key={tt.id} style={styles.ticketRow}>
                  <View>
                    <Text style={styles.ticketName}>{tt.name}</Text>
                    {tt.quantity ? (
                      <Text style={styles.ticketQty}>
                        {(tt.tickets_sold ?? 0)} / {tt.quantity} sold
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.ticketPrice}>
                    ${(tt.price_cents / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Who's Going */}
          {attendees.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Who's Going ({goingCount})
              </Text>
              <View style={styles.attendeeRow}>
                {attendees.slice(0, 8).map((a, i) => (
                  <View key={a.id} style={[styles.attendeeAvatar, { marginLeft: i > 0 ? -10 : 0 }]}>
                    <Avatar
                      uri={a.avatar_url}
                      name={a.full_name}
                      color={a.avatar_color}
                      size={40}
                    />
                  </View>
                ))}
                {goingCount > 8 ? (
                  <View style={[styles.attendeeAvatar, styles.attendeeMore, { marginLeft: -10 }]}>
                    <Text style={styles.attendeeMoreText}>+{goingCount - 8}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Host Actions (if current user is the host) */}
          {isHost ? (
            <View style={styles.section}>
              <View style={styles.hostActionsBanner}>
                <Ionicons name="star" size={16} color={C.gold} />
                <Text style={styles.hostActionsBannerText}>You're hosting this event</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Bottom padding for sticky button */}
        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>

      {/* Sticky RSVP / Buy Button */}
      {!isHost && event.status === 'published' ? (
        <View style={[styles.stickyButton, { paddingBottom: insets.bottom + 12 }]}>
          <GoldButton
            title={
              event.is_paid
                ? hasRsvp
                  ? 'Ticket Purchased ✓'
                  : 'Buy Ticket'
                : hasRsvp
                ? 'Going ✓ — Cancel RSVP'
                : 'RSVP — I\'m Going!'
            }
            onPress={handleRsvp}
            loading={rsvpLoading}
            variant={hasRsvp ? 'outline' : 'filled'}
            size="lg"
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    position: 'relative',
    backgroundColor: C.surface2,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  heroNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  heroNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceBadgeFree: {
    backgroundColor: C.green,
  },
  priceBadgePaid: {
    backgroundColor: C.gold,
  },
  priceBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    padding: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  tagText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  eventName: {
    color: C.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 16,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  hostedByLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  hostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hostName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  details: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  detailSub: {
    color: C.muted,
    fontSize: 13,
    marginTop: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: C.text,
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.85,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  ticketName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  ticketQty: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  ticketPrice: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    borderWidth: 2,
    borderColor: C.bg,
    borderRadius: 22,
  },
  attendeeMore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeMoreText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  hostActionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  hostActionsBannerText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  stickyButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: `${C.bg}F0`,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
  },
  errorTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  errorSubtext: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
