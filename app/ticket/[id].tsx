import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import QRCode from 'react-native-qrcode-svg';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getMyTickets, requestRefund } from '../../lib/api';
import { storage } from '../../lib/storage';
import { logger } from '../../lib/logger';
import { buildTicketQr, ticketShortCode } from '../../lib/qr';
import { formatCents } from '../../lib/fees';
import { formatDateLong, formatTimeRange } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { shadow } from '../../lib/theme';
import type { Ticket } from '../../lib/types';
import { AppText, Badge, BottomSheet, Button, EmptyState, Field, IconButton, Skeleton, SkeletonGroup } from '../../components/ui';
import { MONO_FONT } from '../../components/tickets/WalletTicketCard';

const QR_SIZE = 240;
const QR_WHITE = '#FFFFFF';
const QR_INK = '#0E0C0A';

function statusBadge(ticket: Ticket): { label: string; tone: 'gold' | 'success' | 'danger' | 'neutral' } {
  if (ticket.checked_in) return { label: 'Checked in', tone: 'success' };
  if (ticket.status === 'refunded') return { label: 'Refunded', tone: 'danger' };
  if (ticket.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' };
  if (ticket.status === 'confirmed') return { label: 'Confirmed', tone: 'gold' };
  return { label: ticket.status, tone: 'neutral' };
}

function useFullBrightness() {
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let previous: number | null = null;
      (async () => {
        try {
          const current = await Brightness.getBrightnessAsync();
          if (!active) return;
          previous = current;
          await Brightness.setBrightnessAsync(1);
        } catch (err) {
          logger.info('Brightness unavailable', { error: String(err) });
        }
      })();
      return () => {
        active = false;
        if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => undefined);
      };
    }, []),
  );
}

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const token = session?.access_token;
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  useFullBrightness();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = (await storage.getCachedTickets()).find(x => x.id === id);
      if (cached && !cancelled) {
        setTicket(cached);
        setLoading(false);
      }
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { tickets } = await getMyTickets(token);
        storage.setCachedTickets(tickets);
        const fresh = tickets.find(x => x.id === id);
        if (!cancelled && fresh) setTicket(fresh);
      } catch (err) {
        logger.warn('Ticket refresh failed; using saved copy', { error: String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tickets'));

  const submitRefund = async () => {
    if (!ticket || !token || refundBusy) return;
    setRefundBusy(true);
    try {
      await requestRefund(ticket.id, reason.trim(), token);
      haptic.success();
      showToast('Refund request sent to the host', 'success');
      setRefundOpen(false);
      setReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not request a refund', 'error');
    } finally {
      setRefundBusy(false);
    }
  };

  const header = (
    <View style={[s.header, { paddingTop: insets.top + t.space.xs }]}>
      <IconButton icon="chevron-down" label="Close" onPress={close} />
      <AppText variant="headline" style={{ flex: 1 }} align="center">
        Your ticket
      </AppText>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading && !ticket) {
    return (
      <View style={s.root}>
        {header}
        <SkeletonGroup label="Loading ticket">
          <View style={{ padding: t.space.md, alignItems: 'center', gap: t.space.sm }}>
            <Skeleton width="70%" height={28} />
            <Skeleton width="50%" height={14} />
            <Skeleton width={QR_SIZE + 32} height={QR_SIZE + 32} radius={t.radius.lg} style={{ marginTop: t.space.md }} />
            <Skeleton width={160} height={24} />
          </View>
        </SkeletonGroup>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={s.root}>
        {header}
        <EmptyState
          art="ticket"
          title={token ? 'Ticket not found' : 'Sign in to see this ticket'}
          body={token ? 'It may have been refunded, or it belongs to another account.' : 'Your tickets are saved to your account.'}
          actionLabel={token ? 'Go to Tickets' : 'Sign in'}
          onAction={() => (token ? router.replace('/(tabs)/tickets') : router.push('/auth'))}
        />
      </View>
    );
  }

  const code = ticketShortCode(ticket);
  const badge = statusBadge(ticket);
  const paid = ticket.total_charged_cents > 0 || ticket.unit_price_cents > 0;
  const upcoming = !!ticket.event_start_date && new Date(ticket.event_start_date).getTime() > Date.now();
  const canRefund = paid && ticket.status === 'confirmed' && !ticket.checked_in && upcoming;
  const usable = ticket.status === 'confirmed';
  const typeName = ticket.ticket_type_name ?? ticket.ticket_types?.name ?? 'General admission';
  const time = formatTimeRange(ticket.event_start_date, ticket.event_end_date);

  return (
    <View style={s.root}>
      {header}
      <ScrollView contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xl }} showsVerticalScrollIndicator={false}>
        <View style={[s.pass, { backgroundColor: t.c.surface, borderColor: t.c.goldHairline }, shadow(2, t.c.shadow)]}>
          <View style={s.passTop}>
            <Badge label={badge.label} tone={badge.tone} style={{ alignSelf: 'center' }} />
            <AppText variant="title2" align="center" style={{ marginTop: t.space.sm }}>
              {ticket.event_name ?? 'Event'}
            </AppText>
            <AppText variant="callout" tone="muted" align="center" style={{ marginTop: 4 }}>
              {formatDateLong(ticket.event_start_date)}
              {time ? ` · ${time}` : ''}
            </AppText>
            {ticket.event_venue_name || ticket.event_city ? (
              <AppText variant="callout" tone="muted" align="center">
                {[ticket.event_venue_name, ticket.event_city].filter(Boolean).join(', ')}
              </AppText>
            ) : null}

            <View
              style={[s.qrFrame, { borderColor: t.c.goldHairline, opacity: usable ? 1 : 0.35 }]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={usable ? 'Ticket QR code. Show this at the door to check in.' : `Ticket QR code, ${badge.label.toLowerCase()}`}
            >
              <View style={s.qrCard}>
                <QRCode value={buildTicketQr(ticket)} size={QR_SIZE} color={QR_INK} backgroundColor={QR_WHITE} ecl="M" />
              </View>
            </View>

            <AppText
              variant="title2"
              align="center"
              style={{ fontFamily: MONO_FONT, letterSpacing: 4, marginTop: t.space.md }}
              accessibilityLabel={`Ticket code ${code.split('').join(' ')}`}
              selectable
            >
              {code}
            </AppText>
            <AppText variant="caption" tone="faint" align="center">
              {ticket.checked_in ? 'Already checked in — enjoy the event' : 'Brightness turned up for scanning'}
            </AppText>
          </View>

          <View style={s.perfRow}>
            <View style={[s.notch, s.notchLeft, { backgroundColor: t.c.bg, borderColor: t.c.goldHairline }]} />
            <View style={[s.dash, { borderColor: t.c.border }]} />
            <View style={[s.notch, s.notchRight, { backgroundColor: t.c.bg, borderColor: t.c.goldHairline }]} />
          </View>

          <View style={s.passBottom}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="faint">
                Ticket
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {typeName} × {ticket.quantity}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" tone="faint">
                Paid
              </AppText>
              <AppText variant="bodyStrong">{formatCents(ticket.total_charged_cents, { free: 'Free' })}</AppText>
            </View>
          </View>
        </View>

        <View style={s.actions}>
          <Button title="View event" icon="calendar-outline" variant="secondary" onPress={() => router.push(`/event/${ticket.event_id}`)} fullWidth />
          {canRefund && token ? (
            <Button title="Request refund" icon="return-down-back-outline" variant="ghost" onPress={() => setRefundOpen(true)} fullWidth />
          ) : null}
        </View>
        <View style={s.note}>
          <Ionicons name="cloud-done-outline" size={14} color={t.c.textFaint} />
          <AppText variant="caption" tone="faint">
            Saved on this device — works without signal.
          </AppText>
        </View>
      </ScrollView>

      <BottomSheet
        visible={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Request a refund"
        subtitle="The host reviews each request. Approved refunds return to your original payment method."
        footer={<Button title="Send request" onPress={submitRefund} loading={refundBusy} disabled={!reason.trim()} fullWidth />}
      >
        <Field
          label="Reason"
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={500}
          placeholder="Let the host know why you can’t make it"
        />
      </BottomSheet>
    </View>
  );
}

const NOTCH = 24;

const useStyles = makeStyles(t => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space.md, paddingBottom: t.space.xs, gap: t.space.sm },
  pass: { borderRadius: t.radius.xl, borderWidth: 1 },
  passTop: { paddingHorizontal: t.space.lg, paddingTop: t.space.lg, paddingBottom: t.space.md, alignItems: 'stretch' },
  qrFrame: { alignSelf: 'center', marginTop: t.space.lg, padding: 6, borderRadius: t.radius.lg + 6, borderWidth: 1 },
  qrCard: { backgroundColor: QR_WHITE, padding: t.space.md, borderRadius: t.radius.lg },
  perfRow: { height: NOTCH, flexDirection: 'row', alignItems: 'center' },
  notch: { width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1 },
  notchLeft: { marginLeft: -NOTCH / 2 - 1 },
  notchRight: { marginRight: -NOTCH / 2 - 1 },
  dash: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', marginHorizontal: 6 },
  passBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space.lg, paddingTop: t.space.xs, paddingBottom: t.space.lg, gap: t.space.md },
  actions: { marginTop: t.space.lg, gap: t.space.xs },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: t.space.md },
}));
