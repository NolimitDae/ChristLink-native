import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { getMyRsvps, getMyTickets } from '../../lib/api';
import { storage } from '../../lib/storage';
import { logger } from '../../lib/logger';
import { pluralize } from '../../lib/format';
import type { RSVP, Ticket } from '../../lib/types';
import { AppText, Button, EmptyState, SectionHeader, Skeleton, SkeletonGroup } from '../../components/ui';
import { WalletStack } from '../../components/tickets/WalletStack';
import { MemoryCard } from '../../components/tickets/MemoryCard';
import { WALLET_CARD_HEIGHT } from '../../components/tickets/WalletTicketCard';
import { buildWallet, type WalletItem } from '../../components/tickets/walletItems';
import { useTabBarClearance } from '../../components/TabBar';

export default function TicketsScreen() {
  const t = useTheme();
  const barClearance = useTabBarClearance();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { online } = useAppData();
  const token = session?.access_token;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const hasData = useRef(false);
  const userId = session?.user.id;

  // Never show the previous user's tickets after a sign-out or account switch.
  useEffect(() => {
    hasData.current = false;
    setTickets([]);
    setRsvps([]);
    setFromCache(false);
    setLoading(true);
  }, [userId]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!hasData.current) {
      const [cached, cachedRsvps] = await Promise.all([storage.getCachedTickets(), storage.getCachedRsvps()]);
      if ((cached.length > 0 || cachedRsvps.length > 0) && !hasData.current) {
        setTickets(cached);
        setRsvps(cachedRsvps);
        setLoading(false);
      }
    }
    try {
      const [tk, rs] = await Promise.all([
        getMyTickets(token),
        getMyRsvps(token).catch(err => {
          logger.warn('RSVPs not loaded', { error: String(err) });
          return { rsvps: [] as RSVP[] };
        }),
      ]);
      setTickets(tk.tickets);
      setRsvps(rs.rsvps);
      setFromCache(false);
      hasData.current = true;
      storage.setCachedTickets(tk.tickets);
      storage.setCachedRsvps(rs.rsvps);
    } catch (err) {
      logger.warn('Tickets not loaded; using saved copy', { error: String(err) });
      if (!hasData.current) {
        setTickets(await storage.getCachedTickets());
        setRsvps(await storage.getCachedRsvps());
      }
      setFromCache(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { upcoming, past } = useMemo(() => buildWallet(tickets, rsvps), [tickets, rsvps]);
  const memoryWidth = (width - t.space.md * 2 - t.space.sm) / 2;

  const open = (item: WalletItem) => {
    if (item.kind === 'ticket') router.push(`/ticket/${item.id}`);
    else router.push(`/event/${item.eventId}`);
  };

  const header = (
    <View style={[s.header, { paddingTop: insets.top + t.space.sm }]}>
      <AppText variant="display">Tickets</AppText>
      {token && !loading && upcoming.length > 0 ? (
        <AppText variant="callout" tone="muted">
          {pluralize(upcoming.length, 'upcoming event')}
        </AppText>
      ) : null}
    </View>
  );

  if (!token) {
    return (
      <View style={s.root}>
        {header}
        <EmptyState
          art="ticket"
          title="Your tickets live here"
          body="Sign in to RSVP and buy tickets. They’ll be saved here, even offline."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
          style={{ flex: 1, paddingBottom: barClearance + 16 }}
        />
      </View>
    );
  }

  const offline = fromCache || !online;
  const empty = !loading && upcoming.length === 0 && past.length === 0;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: barClearance + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {offline && !loading ? (
          <View style={[s.offline, { backgroundColor: t.c.surface2, borderColor: t.c.border }]} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color={t.c.textMuted} />
            <AppText variant="caption" tone="muted">
              Offline — showing saved tickets
            </AppText>
          </View>
        ) : null}

        {loading ? (
          <WalletSkeleton />
        ) : empty ? (
          <EmptyState
            art="ticket"
            title="No tickets yet"
            body="When you RSVP or buy a ticket, it shows up here — ready at the door."
            actionLabel="Explore events"
            onAction={() => router.push('/(tabs)/explore')}
          />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Upcoming" />
                <View style={{ paddingHorizontal: t.space.md }}>
                  <WalletStack items={upcoming} onOpen={open} />
                </View>
              </View>
            ) : (
              <View style={[s.noUpcoming, { borderColor: t.c.border }]}>
                <AppText variant="bodyStrong">Nothing coming up</AppText>
                <AppText variant="callout" tone="muted" style={{ marginTop: 2 }}>
                  Find your next gathering in Explore.
                </AppText>
                <Button title="Explore events" variant="ghost" size="sm" iconRight="arrow-forward" onPress={() => router.push('/(tabs)/explore')} style={{ alignSelf: 'flex-start', marginTop: t.space.xs, marginLeft: -t.space.sm }} />
              </View>
            )}

            {past.length > 0 ? (
              <View style={s.section}>
                <SectionHeader eyebrow={pluralize(past.length, 'gathering')} title="Memories" />
                <View style={s.grid}>
                  {past.map(item => (
                    <MemoryCard key={item.key} item={item} width={memoryWidth} onPress={() => router.push(`/event/${item.eventId}`)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function WalletSkeleton() {
  const t = useTheme();
  return (
    <SkeletonGroup label="Loading tickets">
      <View style={{ paddingHorizontal: t.space.md, marginTop: t.space.lg }}>
        <Skeleton width={120} height={20} style={{ marginBottom: t.space.md }} />
        {[0, 1, 2].map(i => (
          <Skeleton
            key={i}
            height={i === 2 ? WALLET_CARD_HEIGHT : 74}
            radius={t.radius.lg}
            style={{ marginBottom: 6, opacity: 1 - i * 0.15 }}
          />
        ))}
      </View>
    </SkeletonGroup>
  );
}

const useStyles = makeStyles(t => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  header: { paddingHorizontal: t.space.md, paddingBottom: t.space.sm, gap: 2 },
  section: { marginTop: t.space.lg },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    alignSelf: 'flex-start',
    marginHorizontal: t.space.md,
    paddingHorizontal: t.space.sm,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noUpcoming: { marginHorizontal: t.space.md, marginTop: t.space.lg, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, paddingHorizontal: t.space.md },
}));
