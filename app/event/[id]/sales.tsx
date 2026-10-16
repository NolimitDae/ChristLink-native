import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { decideRefundRequest, getEventSales, getRefundRequests, hostRefundTicket } from '../../../lib/api';
import { formatCents, salesPerDay, summarizeSales } from '../../../lib/fees';
import { formatDateLong, formatTimeRange } from '../../../lib/format';
import { haptic } from '../../../lib/haptics';
import type { EventSales, RefundRequest } from '../../../lib/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  Screen,
  Segmented,
  Skeleton,
  SkeletonGroup,
  Sparkline,
  StatTile,
} from '../../../components/ui';
import { BuyerRow, RefundRequestRow, RsvpRow } from '../../../components/host/SalesRows';
import { errorMessage } from '../../../components/host/errors';

type ListTab = 'buyers' | 'rsvps' | 'refunds';

export default function EventSalesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;

  const [data, setData] = useState<EventSales | null>(null);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ListTab>('buyers');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chartW, setChartW] = useState(0);

  const load = useCallback(async () => {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setError(null);
    const [salesRes, reqRes] = await Promise.allSettled([getEventSales(id, token), getRefundRequests(id, token)]);
    if (salesRes.status === 'fulfilled') setData(salesRes.value);
    else setError(errorMessage(salesRes.reason, 'Could not load sales.'));
    if (reqRes.status === 'fulfilled') setRequests(reqRes.value);
    setLoading(false);
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const summary = useMemo(() => (data ? summarizeSales(data.tickets, data.rsvps.filter(r => r.status === 'confirmed').length) : null), [data]);
  const trend = useMemo(() => (data ? salesPerDay(data.tickets, 14) : []), [data]);
  const pending = requests.filter(r => r.status === 'pending');

  const refund = (ticketId: string, name: string, amount: number) => {
    Alert.alert('Refund this ticket?', `${name} will be refunded ${formatCents(amount)} to their original payment method. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setBusyId(ticketId);
          try {
            await hostRefundTicket(ticketId, token);
            haptic.success();
            showToast('Refund issued', 'success');
            await load();
          } catch (err) {
            haptic.error();
            showToast(errorMessage(err, 'Refund failed'), 'error');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const decide = async (req: RefundRequest, action: 'approve' | 'deny') => {
    if (!token) return;
    setBusyId(req.id);
    try {
      await decideRefundRequest(req.id, action, token);
      showToast(action === 'approve' ? 'Refund approved' : 'Request denied', action === 'approve' ? 'success' : 'info');
      await load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <Screen title="Sales" back>
        <EmptyState art="ticket" title="Sign in to see sales" actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Sales" back>
        <SkeletonGroup label="Loading sales">
          <View style={{ padding: t.space.md, gap: t.space.sm }}>
            <Skeleton width="70%" height={28} />
            <View style={s.tiles}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} height={84} radius={t.radius.lg} style={{ flexBasis: '47%', flexGrow: 1 }} />
              ))}
            </View>
            <Skeleton height={120} radius={t.radius.lg} />
          </View>
        </SkeletonGroup>
      </Screen>
    );
  }

  if (error || !data || !summary) {
    return (
      <Screen title="Sales" back>
        <EmptyState art="ticket" title="Couldn’t load sales" body={error ?? 'Only the host can view sales for this event.'} actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const ev = data.event;
  const isHost = !user || ev.host_id === user.id;
  const stripeDiffers = Math.abs((data.summary?.hostEarnings ?? summary.net) - summary.net) >= 1;

  return (
    <Screen
      title="Sales"
      back
      right={<IconButton icon="qr-code-outline" label="Check guests in" tone="gold" onPress={() => router.push(`/host/scan?eventId=${ev.id}`)} />}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: insets.bottom + t.space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <AppText variant="title1">{ev.name}</AppText>
        <AppText variant="callout" tone="muted" style={{ marginTop: 4, marginBottom: t.space.lg }}>
          {formatDateLong(ev.start_date)} · {formatTimeRange(ev.start_date, ev.end_date)}
        </AppText>
        {!isHost ? (
          <AppText variant="caption" tone="danger" style={{ marginBottom: t.space.sm }}>
            You’re viewing another host’s event.
          </AppText>
        ) : null}

        <View style={s.tiles}>
          <StatTile label="Tickets sold" value={String(summary.ticketsSold)} tone="gold" />
          <StatTile label="Free RSVPs" value={String(summary.freeRsvps)} />
          <StatTile label="Gross" value={formatCents(summary.gross)} />
          <StatTile label="Fees" value={formatCents(summary.fees)} />
          <StatTile label="Refunds" value={formatCents(summary.refunds)} />
          <StatTile label="Net payout" value={formatCents(summary.net)} tone="success" />
        </View>
        {stripeDiffers ? (
          <AppText variant="caption" tone="faint" style={{ marginTop: t.space.xs }}>
            Stripe-reported earnings: {formatCents(data.summary.hostEarnings)}
          </AppText>
        ) : null}

        <Card style={{ marginTop: t.space.md, gap: t.space.sm }}>
          <View style={s.between}>
            <AppText variant="overline" tone="muted">
              Last 14 days
            </AppText>
            <AppText variant="caption" tone="gold">
              {trend.reduce((a, b) => a + b, 0)} tickets
            </AppText>
          </View>
          <View onLayout={e => setChartW(e.nativeEvent.layout.width)} style={{ height: 72, justifyContent: 'center' }}>
            {trend.some(v => v > 0) && chartW > 0 ? (
              <Sparkline values={trend} width={chartW} height={72} />
            ) : (
              <AppText variant="callout" tone="faint" align="center">
                No ticket sales in the last two weeks
              </AppText>
            )}
          </View>
        </Card>

        <Button title="Check guests in" icon="qr-code-outline" fullWidth onPress={() => router.push(`/host/scan?eventId=${ev.id}`)} style={{ marginTop: t.space.md }} />

        <Segmented
          style={{ marginTop: t.space.lg }}
          options={[
            { value: 'buyers', label: `Buyers ${data.tickets.length}` },
            { value: 'rsvps', label: `RSVPs ${data.rsvps.length}` },
            { value: 'refunds', label: `Refunds${pending.length ? ` ${pending.length}` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />

        <View style={s.list}>
          {tab === 'buyers' ? (
            data.tickets.length === 0 ? (
              <EmptyState compact art="ticket" title="No tickets yet" body="Share your event to get the word out." />
            ) : (
              data.tickets.map((tk, i) => {
                const name = tk.profiles?.full_name || tk.buyer_email || 'this guest';
                return (
                  <BuyerRow
                    key={tk.id}
                    ticket={tk}
                    last={i === data.tickets.length - 1}
                    busy={busyId === tk.id}
                    onRefund={tk.status === 'confirmed' && tk.total_charged_cents > 0 ? () => refund(tk.id, name, tk.total_charged_cents) : undefined}
                  />
                );
              })
            )
          ) : null}
          {tab === 'rsvps' ? (
            data.rsvps.length === 0 ? (
              <EmptyState compact art="people" title="No RSVPs yet" body="Free RSVPs will show up here." />
            ) : (
              data.rsvps.map((r, i) => <RsvpRow key={r.id} rsvp={r} last={i === data.rsvps.length - 1} />)
            )
          ) : null}
          {tab === 'refunds' ? (
            requests.length === 0 ? (
              <EmptyState compact art="ticket" title="No refund requests" body="Requests from attendees appear here for you to approve or deny." />
            ) : (
              requests.map((r, i) => <RefundRequestRow key={r.id} req={r} busy={busyId === r.id} onDecide={a => decide(r, a)} last={i === requests.length - 1} />)
            )
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: {
    marginTop: t.space.md,
    backgroundColor: t.c.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.c.border,
    paddingHorizontal: t.space.md,
  },
}));
