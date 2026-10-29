import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { duplicateEvent, getEventSales, getHostStats, getMyEvents, publishEvent } from '../../lib/api';
import { formatCents, salesPerDay, summarizeSales } from '../../lib/fees';
import { haptic } from '../../lib/haptics';
import { pluralize } from '../../lib/format';
import type { Event, HostStats, Ticket } from '../../lib/types';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  IconButton,
  LineArt,
  ListRow,
  SectionHeader,
  Segmented,
  Skeleton,
  SkeletonGroup,
  StatTile,
} from '../../components/ui';
import { HostEventRow, type RowAction } from '../../components/host/HostEventRow';
import { RequirementRow } from '../../components/host/RequirementCard';
import { errorMessage } from '../../components/host/errors';

type Tab = 'upcoming' | 'drafts' | 'past';
const HOUR = 3_600_000;

function endMs(e: Event): number {
  if (e.end_date) return new Date(e.end_date).getTime();
  if (e.start_date) return new Date(e.start_date).getTime() + 2 * HOUR;
  return Number.POSITIVE_INFINITY;
}

function bucket(events: Event[], now = Date.now()): Record<Tab, Event[]> {
  const drafts = events.filter(e => e.status === 'draft').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const rest = events.filter(e => e.status !== 'draft');
  const past = rest
    .filter(e => e.status === 'completed' || e.status === 'cancelled' || endMs(e) < now)
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  const upcoming = rest.filter(e => !past.includes(e)).sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  return { upcoming, drafts, past };
}

interface SalesSnapshot {
  trend: number[];
  sold14: number;
  net: number;
}

export default function HostTab() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, profile, isAdmin, isVerifiedHost, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;

  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [sales, setSales] = useState<SalesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [sheetEvent, setSheetEvent] = useState<Event | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (!token || !user) {
      setLoading(false);
      return;
    }
    setError(null);
    const [evRes, statRes] = await Promise.allSettled([getMyEvents(token), getHostStats(user.id)]);
    if (statRes.status === 'fulfilled') setStats(statRes.value);
    if (evRes.status === 'rejected') {
      setError(errorMessage(evRes.reason, 'Could not load your events.'));
      setLoading(false);
      return;
    }
    const list = evRes.value.events;
    setEvents(list);
    setLoading(false);
    loaded.current = true;

    const paid = bucket(list)
      .upcoming.filter(e => e.is_paid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
    const results = await Promise.allSettled(paid.map(e => getEventSales(e.id, token)));
    const tickets: Ticket[] = results.flatMap(r => (r.status === 'fulfilled' ? r.value.tickets : []));
    const trend = salesPerDay(tickets, 14);
    setSales({ trend, sold14: trend.reduce((a, b) => a + b, 0), net: summarizeSales(tickets, 0).net });
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (loaded.current) load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshProfile()]);
    setRefreshing(false);
  };

  const buckets = useMemo(() => bucket(events), [events]);
  const totalGoing = buckets.upcoming.reduce((n, e) => n + (e.going_count ?? 0), 0);
  const acct = profile?.host_stripe_accounts?.[0];
  const payoutsReady = !!acct?.payouts_enabled;
  const needsId = !isVerifiedHost && !profile?.identity_verified;

  const runPublish = async (e: Event) => {
    if (!token) return;
    setActionBusy(true);
    try {
      await publishEvent(e.id, token);
      haptic.success();
      showToast(`${e.name} is live`, 'success');
      setSheetEvent(null);
      await load();
    } catch (err) {
      haptic.error();
      Alert.alert('Couldn’t publish', errorMessage(err), [
        { text: 'Open editor', onPress: () => router.push(`/event/create?id=${e.id}`) },
        { text: 'OK', style: 'cancel' },
      ]);
    } finally {
      setActionBusy(false);
    }
  };

  const runDuplicate = async (e: Event) => {
    if (!token) return;
    setActionBusy(true);
    try {
      await duplicateEvent(e.id, token);
      showToast('Duplicated as a draft', 'success');
      setSheetEvent(null);
      setTab('drafts');
      await load();
    } catch (err) {
      showToast(errorMessage(err, 'Could not duplicate'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const rowActions = (e: Event): RowAction[] => {
    const salesAction: RowAction = { key: 'sales', label: 'Sales', icon: 'stats-chart-outline', onPress: () => router.push(`/event/${e.id}/sales`) };
    const checkin: RowAction = { key: 'checkin', label: 'Check-in', icon: 'qr-code-outline', onPress: () => router.push(`/host/scan?eventId=${e.id}`), primary: true };
    const edit: RowAction = { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => router.push(`/event/create?id=${e.id}`) };
    if (tab === 'drafts') return [{ key: 'publish', label: 'Publish', icon: 'rocket-outline', onPress: () => runPublish(e), primary: true }, edit];
    if (tab === 'past') return [salesAction, { key: 'dup', label: 'Duplicate', icon: 'copy-outline', onPress: () => runDuplicate(e) }];
    return [checkin, salesAction, edit];
  };

  if (!session || !user) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <AppText variant="display">Host</AppText>
        </View>
        <EmptyState
          art="calendar"
          title="Host faith events"
          body="Create worship nights, Bible studies and retreats, sell tickets and check guests in — all from your phone."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      </View>
    );
  }

  const list = buckets[tab];
  const showChecklist = needsId || !payoutsReady;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="display">Host</AppText>
            {stats ? (
              <AppText variant="caption" tone="muted">
                {pluralize(stats.eventsHosted, 'event')} hosted · {pluralize(stats.totalAttendees, 'guest')} all-time
              </AppText>
            ) : null}
          </View>
          {isAdmin ? <IconButton icon="shield-checkmark-outline" label="Admin" onPress={() => router.push('/admin')} /> : null}
          <IconButton icon="wallet-outline" label="Payouts" onPress={() => router.push('/host/payouts')} />
        </View>

        {showChecklist ? (
          <View style={s.section}>
            <Card>
              <AppText variant="overline" tone="gold">
                Setup checklist
              </AppText>
              <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: 4 }}>
                Only needed for paid events — free events can go live right away.
              </AppText>
              {needsId ? (
                <RequirementRow
                  icon="id-card-outline"
                  title="Verify your identity"
                  body="A quick ID check keeps our community safe"
                  onPress={() => router.push('/host/verify')}
                  last={payoutsReady}
                />
              ) : null}
              {!payoutsReady ? (
                <RequirementRow
                  icon="card-outline"
                  title={acct ? 'Finish Stripe setup' : 'Set up payouts'}
                  body={acct ? 'Stripe needs a few more details before payouts start' : 'Connect Stripe to get paid for ticket sales'}
                  onPress={() => router.push('/host/payouts')}
                  last
                />
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={s.section}>
          {loading ? (
            <SkeletonGroup label="Loading stats">
              <View style={s.tiles}>
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} height={92} radius={t.radius.lg} style={{ flexBasis: '47%', flexGrow: 1 }} />
                ))}
              </View>
            </SkeletonGroup>
          ) : (
            <View style={s.tiles}>
              <StatTile label="Upcoming events" value={String(buckets.upcoming.length)} onPress={() => setTab('upcoming')} />
              <StatTile label="Total going" value={String(totalGoing)} />
              <StatTile label="Tickets · 14 days" value={sales ? String(sales.sold14) : '–'} trend={sales?.trend} tone="gold" />
              <StatTile label="Net earnings" value={sales ? formatCents(sales.net) : '–'} tone="success" />
            </View>
          )}
        </View>

        <View style={s.section}>
          <Button title="Create an event" icon="add-circle-outline" size="lg" fullWidth onPress={() => router.push('/event/create')} />
        </View>

        <SectionHeader title="My events" style={{ marginTop: t.space.sm }} />
        <View style={[s.section, { marginTop: 0 }]}>
          <Segmented
            options={[
              { value: 'upcoming', label: `Upcoming${buckets.upcoming.length ? ` ${buckets.upcoming.length}` : ''}` },
              { value: 'drafts', label: `Drafts${buckets.drafts.length ? ` ${buckets.drafts.length}` : ''}` },
              { value: 'past', label: 'Past' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        <View style={[s.section, { gap: t.space.sm }]}>
          {loading ? (
            <SkeletonGroup label="Loading events">
              <View style={{ gap: t.space.sm }}>
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} height={128} radius={t.radius.lg} />
                ))}
              </View>
            </SkeletonGroup>
          ) : error ? (
            <EmptyState compact art="calendar" title="Couldn’t load your events" body={error} actionLabel="Try again" onAction={load} />
          ) : list.length === 0 ? (
            <EmptyState
              compact
              art={tab === 'drafts' ? 'ticket' : 'calendar'}
              title={tab === 'upcoming' ? 'No upcoming events' : tab === 'drafts' ? 'No drafts' : 'No past events yet'}
              body={tab === 'past' ? 'Events you’ve hosted will appear here with their sales.' : 'Start something your community will love.'}
              actionLabel={tab === 'past' ? undefined : 'Create an event'}
              onAction={tab === 'past' ? undefined : () => router.push('/event/create')}
            />
          ) : (
            list.map(e => (
              <HostEventRow key={e.id} event={e} actions={rowActions(e)} onOpen={() => router.push(`/event/${e.id}`)} onMore={() => setSheetEvent(e)} />
            ))
          )}
        </View>

        <View style={s.section}>
          <Card variant="featured" onPress={() => router.push('/host/serve')} accessibilityLabel="Serve teams: recruit volunteers">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
              <LineArt name="serve" size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="title3">Serve teams</AppText>
                <AppText variant="callout" tone="muted">
                  Recruit volunteers, build shifts and check your team in.
                </AppText>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      <BottomSheet visible={!!sheetEvent} onClose={() => setSheetEvent(null)} title={sheetEvent?.name} subtitle="Event actions">
        {sheetEvent ? (
          <View style={s.sheetGroup}>
            <ListRow icon="eye-outline" title="View event page" onPress={() => { setSheetEvent(null); router.push(`/event/${sheetEvent.id}`); }} />
            <ListRow icon="create-outline" title="Edit details" onPress={() => { setSheetEvent(null); router.push(`/event/create?id=${sheetEvent.id}`); }} />
            {sheetEvent.status !== 'draft' ? (
              <ListRow icon="stats-chart-outline" title="Sales & guests" onPress={() => { setSheetEvent(null); router.push(`/event/${sheetEvent.id}/sales`); }} />
            ) : null}
            {sheetEvent.status === 'published' ? (
              <ListRow icon="qr-code-outline" title="Check guests in" onPress={() => { setSheetEvent(null); router.push(`/host/scan?eventId=${sheetEvent.id}`); }} />
            ) : null}
            <ListRow icon="hand-left-outline" title="Volunteers" subtitle="Serve roles and shifts" onPress={() => { setSheetEvent(null); router.push(`/host/serve?eventId=${sheetEvent.id}`); }} />
            <ListRow icon="copy-outline" title="Duplicate" subtitle="Creates a new draft" disabled={actionBusy} onPress={() => runDuplicate(sheetEvent)} last={sheetEvent.status !== 'draft'} />
            {sheetEvent.status === 'draft' ? (
              <ListRow
                icon="rocket-outline"
                title="Publish now"
                subtitle={sheetEvent.is_paid && !sheetEvent.listing_fee_paid ? 'Paid events need the listing fee paid first' : undefined}
                disabled={actionBusy}
                onPress={() => runPublish(sheetEvent)}
                last
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, paddingHorizontal: t.space.md, paddingTop: t.space.sm, paddingBottom: t.space.md },
  section: { paddingHorizontal: t.space.md, marginBottom: t.space.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  sheetGroup: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
