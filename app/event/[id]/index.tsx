import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform, Pressable, RefreshControl, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { makeStyles, useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { ApiError, cancelRsvp, getEvent, getEventAttendees, getForum, rsvpToEvent } from '../../../lib/api';
import { FeatureError, getOpenShifts } from '../../../lib/features';
import { eventFormatLabel, eventTiming, formatDateShort, formatTimeRange, pluralize } from '../../../lib/format';
import { eventShareUrl, isSoldOut, locationLabel, priceLabel } from '../../../lib/eventHelpers';
import { haptic } from '../../../lib/haptics';
import { logger } from '../../../lib/logger';
import type { Event, ForumMessage, PersonSummary, ServeShift } from '../../../lib/types';
import { useFriendsGoing } from '../../../hooks/useFriendsGoing';
import { useReport } from '../../../components/ReportSheet';
import { useShareCard } from '../../../components/ShareCard';
import { Avatar } from '../../../components/Avatar';
import {
  AppText,
  BottomSheet,
  Button,
  EmptyState,
  Glass,
  IconButton,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  TimingBadge,
} from '../../../components/ui';
import { EventHero } from '../../../components/event/EventHero';
import { GalleryStrip } from '../../../components/event/GalleryStrip';
import {
  AboutSection,
  AttendeesSheet,
  EventDetailSkeleton,
  ForumPreview,
  InfoGrid,
  InfoTile,
  ServeCard,
  WhoGoingRow,
} from '../../../components/event/EventSections';
import { ACTION_BAR_HEIGHT, EventActionBar } from '../../../components/event/EventActionBar';
import { CheckoutSheet } from '../../../components/event/CheckoutSheet';
import { InviteSheet } from '../../../components/event/InviteSheet';
import { RsvpCelebration } from '../../../components/event/RsvpCelebration';
import { useAttendance } from '../../../components/event/useAttendance';
import { clearEventReminders, setupEventReminders } from '../../../components/event/reminders';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';
type SheetName = 'menu' | 'attendees' | 'checkout' | 'invite' | null;

const SHEET_SWAP_DELAY = 320;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(Math.min(height * 0.58, width));
  const { session, user } = useAuth();
  const token = session?.access_token;
  const { showToast } = useToast();
  const report = useReport();
  const shareCard = useShareCard();
  const attendance = useAttendance(id);
  const friendsMap = useFriendsGoing(id ? [id] : []);

  const [event, setEvent] = useState<Event | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [people, setPeople] = useState<{ attendees: PersonSummary[]; total: number }>({ attendees: [], total: 0 });
  const [forum, setForum] = useState<ForumMessage[]>([]);
  const [forumLoading, setForumLoading] = useState(true);
  const [shifts, setShifts] = useState<ServeShift[]>([]);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [celebration, setCelebration] = useState({ play: 0, title: 'You’re going!' });
  const reminderPending = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const isHost = !!user && !!event && user.id === event.host_id;
  const canSeePrivate = isHost || attendance.attending;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const ev = await getEvent(id, token);
      setEvent(ev);
      setLoadState('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setLoadState('notFound');
      else {
        logger.warn('Event load failed', { error: String(err) });
        setLoadState(prev => (prev === 'ready' ? 'ready' : 'error'));
        showToast(err instanceof Error ? err.message : 'Could not load event', 'error');
      }
    }
  }, [id, token, showToast]);

  const loadPeople = useCallback(async () => {
    if (!id) return;
    try {
      setPeople(await getEventAttendees(id, token));
    } catch (err) {
      logger.info('Attendees hidden or unavailable', { error: String(err) });
    }
  }, [id, token]);

  const loadShifts = useCallback(async () => {
    if (!id) return;
    try {
      setShifts(await getOpenShifts({ eventId: id }));
    } catch (err) {
      if (!(err instanceof FeatureError && err.notSetUp)) logger.info('Serve shifts unavailable', { error: String(err) });
      setShifts([]);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadPeople();
    loadShifts();
  }, [load, loadPeople, loadShifts]);

  const forumEnabled = !!event?.forum_enabled;
  useEffect(() => {
    if (!id || !forumEnabled || !canSeePrivate) return;
    let cancelled = false;
    setForumLoading(true);
    getForum(id, token)
      .then(msgs => {
        if (!cancelled) setForum(msgs);
      })
      .catch(err => logger.info('Forum preview unavailable', { error: String(err) }))
      .finally(() => {
        if (!cancelled) setForumLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, forumEnabled, canSeePrivate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadPeople(), loadShifts(), attendance.refresh()]);
    setRefreshing(false);
  };

  const requireAuth = (): string | null => {
    if (!token) {
      router.push('/auth');
      return null;
    }
    return token;
  };

  const celebrate = (title: string) => {
    reminderPending.current = true;
    setCelebration(c => ({ play: c.play + 1, title }));
  };

  const onCelebrationDone = useCallback(() => {
    if (!reminderPending.current || !event) return;
    reminderPending.current = false;
    setupEventReminders(event, msg => showToast(msg, 'info'));
  }, [event, showToast]);

  const rsvp = async () => {
    const tk = requireAuth();
    if (!tk || !event || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      await rsvpToEvent(event.id, tk);
      attendance.setRsvp(true);
      setEvent(e => (e ? { ...e, going_count: e.going_count + 1 } : e));
      celebrate('You’re going!');
      loadPeople();
    } catch (err) {
      haptic.error();
      showToast(err instanceof Error ? err.message : 'Could not RSVP', 'error');
    } finally {
      setRsvpBusy(false);
    }
  };

  const confirmCancel = () => {
    const tk = requireAuth();
    if (!tk || !event) return;
    Alert.alert('Cancel your RSVP?', 'You can RSVP again any time while spots are open.', [
      { text: 'Keep RSVP', style: 'cancel' },
      {
        text: 'Cancel RSVP',
        style: 'destructive',
        onPress: async () => {
          setRsvpBusy(true);
          try {
            await cancelRsvp(event.id, tk);
            attendance.setRsvp(false);
            setEvent(e => (e ? { ...e, going_count: Math.max(0, e.going_count - 1) } : e));
            await clearEventReminders(event.id);
            haptic.light();
            showToast('RSVP cancelled', 'info');
            loadPeople();
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not cancel', 'error');
          } finally {
            setRsvpBusy(false);
          }
        },
      },
    ]);
  };

  const onPurchased = (_code: string | undefined, qty: number) => {
    setEvent(e => (e ? { ...e, going_count: e.going_count + qty } : e));
    attendance.refresh();
    celebrate('Ticket purchased');
  };

  const afterMenu = (fn: () => void) => {
    setSheet(null);
    setTimeout(fn, SHEET_SWAP_DELAY);
  };

  if (loadState === 'loading' && !event) {
    return (
      <View style={[s.root]}>
        <EventDetailSkeleton heroHeight={heroHeight} />
        <View style={[s.floatRow, { top: insets.top + 6 }]}>
          <IconButton icon="chevron-back" label="Back" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        </View>
      </View>
    );
  }

  if (!event) {
    const notFound = loadState === 'notFound';
    return (
      <Screen back>
        <EmptyState
          art={notFound ? 'calendar' : 'offline'}
          title={notFound ? 'Event not found' : 'Couldn’t load this event'}
          body={notFound ? 'It may have been removed or the link is wrong.' : 'Check your connection and try again.'}
          actionLabel={notFound ? 'Explore events' : 'Try again'}
          onAction={
            notFound
              ? () => router.replace('/(tabs)/explore')
              : () => {
                  setLoadState('loading');
                  load();
                }
          }
        />
      </Screen>
    );
  }

  const url = eventShareUrl(event.id);
  const timing = eventTiming(event.start_date, event.end_date);
  const ended = timing.kind === 'past';
  const cancelled = event.status === 'cancelled';
  const published = event.status === 'published';
  const soldOut = isSoldOut(event);
  const myTickets = attendance.tickets;
  const ticketQty = myTickets.reduce((n, tk) => n + tk.quantity, 0);
  const friends = friendsMap[event.id];
  const showBar = !cancelled && (published || isHost);
  const hostVerified = event.host_role === 'verified' || event.host_role === 'admin';
  const place = [event.address, event.city, event.state].filter(Boolean).join(', ');

  const openMaps = () => {
    const q = encodeURIComponent([event.venue_name, event.address, event.city, event.state, event.zip].filter(Boolean).join(', '));
    const hasCoords = typeof event.lat === 'number' && typeof event.lng === 'number';
    const mapUrl =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${q}${hasCoords ? `&ll=${event.lat},${event.lng}` : ''}`
        : `geo:${hasCoords ? `${event.lat},${event.lng}` : '0,0'}?q=${q}`;
    Linking.openURL(mapUrl).catch(() => showToast('Could not open maps', 'error'));
  };

  const openJoinLink = () => {
    if (!event.online_url) return;
    Linking.openURL(event.online_url).catch(() => showToast('Could not open link', 'error'));
  };

  const shareLink = async () => {
    try {
      await Share.share({ message: `${event.name} — ${url}`, url, title: event.name });
    } catch (err) {
      logger.warn('Share failed', { error: String(err) });
    }
  };

  const topBarOpacity = scrollY.interpolate({ inputRange: [heroHeight - 170, heroHeight - 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const online = event.format === 'online';
  const hybrid = event.format === 'hybrid';
  const placeSub = online
    ? canSeePrivate && event.online_url
      ? 'Tap to join'
      : 'Link shared with guests'
    : [place, hybrid ? 'Also streaming online' : null].filter(Boolean).join(' · ') || eventFormatLabel(event.format);
  const canOpenPlace = online ? canSeePrivate && !!event.online_url : !!(event.venue_name || event.address || event.city || typeof event.lat === 'number');

  const renderActions = () => {
    const invite =
      token && published && !ended ? <IconButton icon="person-add-outline" label="Invite friends" onPress={() => setSheet('invite')} size={44} /> : null;
    if (isHost) {
      return (
        <>
          {invite}
          <Button title="Manage" variant="secondary" size="md" onPress={() => router.push(`/event/create?id=${event.id}`)} />
          <Button title="Sales" icon="stats-chart" size="md" onPress={() => router.push(`/event/${event.id}/sales`)} />
        </>
      );
    }
    if (ended) return <Button title="Event ended" variant="secondary" disabled />;
    if (!event.is_paid) {
      if (attendance.rsvp) {
        return (
          <>
            {invite}
            <Button title="Going" icon="checkmark-circle" variant="secondary" onPress={confirmCancel} loading={rsvpBusy} accessibilityHint="Opens a prompt to cancel your RSVP" />
          </>
        );
      }
      return (
        <>
          {invite}
          <Button title={soldOut ? 'Full' : 'RSVP'} icon={soldOut ? undefined : 'checkmark'} onPress={rsvp} loading={rsvpBusy} disabled={soldOut} haptics={false} />
        </>
      );
    }
    if (myTickets.length > 0) {
      return (
        <>
          {invite}
          <Button title="View ticket" icon="qr-code-outline" onPress={() => router.push(`/ticket/${myTickets[0].id}`)} />
        </>
      );
    }
    return (
      <>
        {invite}
        <Button
          title={soldOut ? 'Sold out' : 'Get tickets'}
          icon={soldOut ? undefined : 'ticket-outline'}
          disabled={soldOut}
          onPress={() => {
            if (requireAuth()) setSheet('checkout');
          }}
        />
      </>
    );
  };

  const barTitle = isHost
    ? 'Your event'
    : event.is_paid && myTickets.length > 0
      ? 'You’re going'
      : !event.is_paid && attendance.rsvp
        ? 'You’re going'
        : priceLabel(event);
  const barCaption = isHost
    ? `${pluralize(event.going_count, 'guest')}${event.status !== 'published' ? ` · ${event.status}` : ''}`
    : event.is_paid && myTickets.length > 0
      ? pluralize(ticketQty, 'ticket')
      : !event.is_paid && attendance.rsvp
        ? 'Saved to your Tickets'
        : event.is_paid
          ? 'plus service fee'
          : 'Free RSVP';

  return (
    <View style={s.root}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingBottom: (showBar ? ACTION_BAR_HEIGHT : 0) + insets.bottom + t.space.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} progressViewOffset={insets.top + 40} />}
      >
        <EventHero event={event} height={heroHeight} scrollY={scrollY} />

        <View style={s.titleBlock}>
          {cancelled ? (
            <View style={[s.banner, { backgroundColor: t.c.dangerDim, borderColor: t.c.danger }]} accessibilityRole="alert">
              <Ionicons name="close-circle" size={18} color={t.c.danger} />
              <AppText variant="callout" tone="danger" style={{ flex: 1 }}>
                This event has been cancelled.{event.is_paid ? ' Ticket holders are refunded automatically.' : ''}
              </AppText>
            </View>
          ) : !published && isHost ? (
            <View style={[s.banner, { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline }]}>
              <Ionicons name="eye-off-outline" size={18} color={t.c.goldText} />
              <AppText variant="callout" tone="gold" style={{ flex: 1 }}>
                {event.status === 'draft' ? 'Draft — only you can see this event.' : `This event is ${event.status}.`}
              </AppText>
            </View>
          ) : null}
          <View style={s.overlineRow}>
            <AppText variant="overline" tone="gold">
              {event.event_type ?? 'Gathering'}
            </AppText>
            {event.age_group ? (
              <AppText variant="overline" tone="faint">
                · {event.age_group}
              </AppText>
            ) : null}
          </View>
          <AppText variant="title1" style={{ marginTop: t.space.xxs }}>
            {event.name}
          </AppText>
          {!cancelled ? <TimingBadge start={event.start_date} end={event.end_date} style={{ marginTop: t.space.xs }} /> : null}
          <Pressable
            onPress={() => router.push(`/user/${event.host_id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Hosted by ${event.host_name ?? 'host'}${hostVerified ? ', verified host' : ''}. View profile`}
            style={({ pressed }) => [s.hostRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar uri={event.host_avatar_url} name={event.host_name} color={event.host_avatar_color} size={36} />
            <AppText variant="callout" tone="muted" style={{ flexShrink: 1 }} numberOfLines={1}>
              Hosted by{' '}
              <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
                {event.host_name ?? 'a Christ Link host'}
              </AppText>
            </AppText>
            {hostVerified ? <Ionicons name="checkmark-circle" size={16} color={t.c.goldText} accessibilityLabel="Verified" /> : null}
            <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
          </Pressable>
        </View>

        <InfoGrid>
          <InfoTile icon="calendar-outline" label="Date" value={formatDateShort(event.start_date)} sub={formatTimeRange(event.start_date, event.end_date) || 'Time TBA'} />
          <InfoTile
            icon={online ? 'videocam-outline' : 'location-outline'}
            label="Place"
            value={online ? 'Online' : locationLabel({ ...event, format: 'in_person' })}
            sub={placeSub}
            subTone={online && canSeePrivate && event.online_url ? 'gold' : 'muted'}
            onPress={canOpenPlace ? (online ? openJoinLink : openMaps) : undefined}
            hint={online ? 'Opens the join link' : 'Opens maps'}
          />
          <InfoTile
            icon="pricetag-outline"
            label="Price"
            value={priceLabel(event)}
            sub={event.is_paid ? (soldOut ? 'Sold out' : '+ 7% service fee') : 'No ticket needed'}
            subTone={soldOut ? 'gold' : 'muted'}
          />
          <InfoTile
            icon="people-outline"
            label="Going"
            value={String(event.going_count)}
            sub={event.max_capacity ? `of ${event.max_capacity} spots` : event.going_count === 1 ? 'person' : 'people'}
          />
        </InfoGrid>

        {online || hybrid ? (
          canSeePrivate && event.online_url ? (
            <Pressable onPress={openJoinLink} accessibilityRole="link" accessibilityLabel="Open join link" style={s.joinLink}>
              <Ionicons name="link-outline" size={16} color={t.c.goldText} />
              <AppText variant="callout" tone="gold" numberOfLines={1} style={{ flex: 1 }}>
                {event.online_url}
              </AppText>
            </Pressable>
          ) : null
        ) : null}

        <View style={s.section}>
          <WhoGoingRow
            attendees={people.attendees}
            total={people.total}
            friends={friends}
            goingCount={event.going_count}
            onPress={() => setSheet('attendees')}
          />
        </View>

        {event.gallery_urls && event.gallery_urls.length > 0 ? (
          <View style={s.section}>
            <SectionHeader title="Gallery" />
            <GalleryStrip urls={event.gallery_urls} />
          </View>
        ) : null}

        {event.description ? (
          <View style={s.section}>
            <SectionHeader title="About" />
            <AboutSection text={event.description} />
          </View>
        ) : null}

        {event.forum_enabled && !cancelled ? (
          <View style={s.section}>
            <SectionHeader title="Discussion" actionLabel={canSeePrivate ? 'Open' : undefined} onAction={() => router.push(`/event/${event.id}/forum`)} />
            <ForumPreview messages={forum} loading={forumLoading} canJoin={canSeePrivate} onOpen={() => router.push(`/event/${event.id}/forum`)} />
          </View>
        ) : null}

        {shifts.length > 0 && !cancelled && !ended ? (
          <View style={s.section}>
            <ServeCard shifts={shifts} onPress={() => router.push('/explore?tab=serve')} />
          </View>
        ) : null}
      </Animated.ScrollView>

      <Animated.View style={[s.topBar, { opacity: topBarOpacity }]} pointerEvents="none">
        <Glass intensity={70} style={[s.topBarInner, { paddingTop: insets.top, height: insets.top + 52, borderBottomColor: t.c.border }]}>
          <AppText variant="headline" numberOfLines={1} align="center" style={{ fontFamily: t.fonts.display, fontSize: 18 }}>
            {event.name}
          </AppText>
        </Glass>
      </Animated.View>

      <View style={[s.floatRow, { top: insets.top + 6 }]} pointerEvents="box-none">
        <IconButton icon="chevron-back" label="Back" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <IconButton icon="share-outline" label="Share event" tone="glass" onPress={shareLink} />
          <IconButton icon="ellipsis-horizontal" label="More options" tone="glass" onPress={() => setSheet('menu')} />
        </View>
      </View>

      {showBar ? (
        <EventActionBar title={barTitle} caption={barCaption} captionTone={barTitle === 'You’re going' ? 'gold' : 'muted'}>
          {renderActions()}
        </EventActionBar>
      ) : null}

      <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title="Event options">
        <ListGroup>
          <ListRow icon="share-outline" title="Share link" onPress={() => afterMenu(shareLink)} />
          <ListRow
            icon="image-outline"
            title="Share card"
            subtitle="Sized for Instagram Stories"
            onPress={() =>
              afterMenu(() =>
                shareCard.open({ kind: 'event', name: event.name, start: event.start_date, place: locationLabel(event), coverUrl: event.cover_url, url }),
              )
            }
          />
          <ListRow
            icon="copy-outline"
            title="Copy link"
            onPress={async () => {
              setSheet(null);
              await Clipboard.setStringAsync(url);
              haptic.success();
              showToast('Link copied', 'success');
            }}
            last={isHost && !(event.is_paid && myTickets.length > 0)}
          />
          {event.is_paid && myTickets.length > 0 && published && !ended ? (
            <ListRow icon="add-circle-outline" title="Buy more tickets" onPress={() => afterMenu(() => setSheet('checkout'))} last={isHost} />
          ) : null}
          {!isHost ? (
            <ListRow
              icon="flag-outline"
              title="Report event"
              destructive
              last
              onPress={() => afterMenu(() => report.open({ type: 'event', id: event.id, authorId: event.host_id, authorName: event.host_name }))}
            />
          ) : null}
        </ListGroup>
      </BottomSheet>

      <AttendeesSheet visible={sheet === 'attendees'} onClose={() => setSheet(null)} attendees={people.attendees} total={Math.max(people.total, event.going_count)} />
      {event.is_paid ? <CheckoutSheet visible={sheet === 'checkout'} onClose={() => setSheet(null)} event={event} onPurchased={onPurchased} /> : null}
      {token ? <InviteSheet visible={sheet === 'invite'} onClose={() => setSheet(null)} eventId={event.id} eventName={event.name} /> : null}
      {report.sheet}
      {shareCard.sheet}

      <RsvpCelebration
        play={celebration.play}
        title={celebration.title}
        eventName={event.name}
        start={event.start_date}
        onDone={onCelebrationDone}
      />
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  titleBlock: { paddingHorizontal: t.space.md, marginTop: -t.space.xxl, marginBottom: t.space.lg },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    padding: t.space.sm,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: t.space.md,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginTop: t.space.md, minHeight: 44, alignSelf: 'flex-start' },
  section: { marginTop: t.space.lg },
  joinLink: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginHorizontal: t.space.md, marginTop: t.space.sm, minHeight: 44 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBarInner: { paddingHorizontal: 112, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  floatRow: { position: 'absolute', left: t.space.md, right: t.space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}));
