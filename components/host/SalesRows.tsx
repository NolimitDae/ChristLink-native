import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../../contexts/ThemeContext';
import { formatCents } from '../../lib/fees';
import { formatDateShort, timeAgo } from '../../lib/format';
import { ticketShortCode } from '../../lib/qr';
import type { EventSales, RefundRequest, Ticket } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, Badge, Button } from '../ui';

const STATUS_TONE: Record<Ticket['status'], 'success' | 'neutral' | 'danger' | 'gold'> = {
  confirmed: 'success',
  pending: 'gold',
  cancelled: 'neutral',
  refunded: 'danger',
  failed: 'danger',
};

export function BuyerRow({ ticket, onRefund, busy, last }: { ticket: Ticket; onRefund?: () => void; busy?: boolean; last?: boolean }) {
  const s = useStyles();
  const name = ticket.profiles?.full_name || ticket.buyer_email || ticket.profiles?.email || 'Guest';
  const email = ticket.buyer_email ?? ticket.profiles?.email;
  const typeName = ticket.ticket_type_name ?? ticket.ticket_types?.name ?? 'Ticket';
  return (
    <View style={[s.row, !last && s.divider]}>
      <Avatar uri={ticket.profiles?.avatar_url} name={name} color={ticket.profiles?.avatar_color} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.between}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </AppText>
          <AppText variant="bodyStrong">{formatCents(ticket.total_charged_cents, { free: 'Free' })}</AppText>
        </View>
        {email && email !== name ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {email}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="muted">
          {typeName} × {ticket.quantity} · #{ticketShortCode(ticket)}
          {ticket.checked_in ? ' · Checked in' : ''}
        </AppText>
        <View style={[s.between, { marginTop: 4 }]}>
          <Badge label={ticket.status} tone={STATUS_TONE[ticket.status]} />
          {onRefund ? <Button title="Refund" variant="danger" size="sm" onPress={onRefund} loading={busy} /> : null}
        </View>
      </View>
    </View>
  );
}

export function RsvpRow({ rsvp, last }: { rsvp: EventSales['rsvps'][number]; last?: boolean }) {
  const s = useStyles();
  const name = rsvp.profiles?.full_name || rsvp.profiles?.email || 'Guest';
  return (
    <View style={[s.row, { alignItems: 'center' }, !last && s.divider]}>
      <Avatar uri={rsvp.profiles?.avatar_url} name={name} color={rsvp.profiles?.avatar_color} size={36} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted">
          RSVP’d {formatDateShort(rsvp.created_at)}
        </AppText>
      </View>
      <Badge label={rsvp.status} tone={rsvp.status === 'confirmed' ? 'success' : 'neutral'} />
    </View>
  );
}

export function RefundRequestRow({
  req,
  onDecide,
  busy,
  last,
}: {
  req: RefundRequest;
  onDecide: (action: 'approve' | 'deny') => void;
  busy?: boolean;
  last?: boolean;
}) {
  const s = useStyles();
  const name = req.profiles?.full_name ?? 'Attendee';
  return (
    <View style={[s.row, !last && s.divider]}>
      <Avatar uri={req.profiles?.avatar_url} name={name} color={req.profiles?.avatar_color} size={40} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={s.between}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </AppText>
          {req.amount_cents ? <AppText variant="bodyStrong">{formatCents(req.amount_cents)}</AppText> : null}
        </View>
        <AppText variant="callout" tone="muted">
          {req.reason?.trim() ? `“${req.reason.trim()}”` : 'No reason given'}
        </AppText>
        <AppText variant="caption" tone="faint">
          Requested {timeAgo(req.created_at)}
        </AppText>
        {req.status === 'pending' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Button title="Approve" size="sm" onPress={() => onDecide('approve')} disabled={busy} />
            <Button title="Deny" size="sm" variant="secondary" onPress={() => onDecide('deny')} disabled={busy} />
          </View>
        ) : (
          <Badge label={req.status} tone={req.status === 'approved' ? 'success' : 'neutral'} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm, alignItems: 'flex-start' },
  divider: { borderBottomWidth: 1, borderBottomColor: t.c.border },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
}));
