import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { CardField } from '@stripe/stripe-react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { eventFormatLabel, formatDateLong, formatTimeRange } from '../../lib/format';
import { formatCents, LISTING_FEE_CENTS } from '../../lib/fees';
import type { Event } from '../../lib/types';
import { EventCard } from '../EventCard';
import { AppText, Badge, Button, Card, Field } from '../ui';
import type { EventDraft } from './eventDraft';
import { RequirementRow } from './RequirementCard';

export interface Blocker {
  key: string;
  title: string;
  body: string;
  route?: string;
}

interface ReviewProps {
  draft: EventDraft;
  preview: Event;
  needsFee: boolean;
  promo: string;
  onPromoChange: (v: string) => void;
  onApplyPromo: () => void;
  promoBusy: boolean;
  promoError: string | null;
  finalCents: number;
  onCardComplete: (v: boolean) => void;
  blockers: Blocker[];
  onBlockerPress: (route: string) => void;
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.sumRow, !last && s.divider]}>
      <AppText variant="caption" tone="muted" style={{ width: 96 }}>
        {label}
      </AppText>
      <AppText variant="callout" style={{ flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

export function CreateReview(p: ReviewProps) {
  const t = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const d = p.draft;
  const where =
    d.format === 'online'
      ? 'Online'
      : [d.venue_name, d.address, [d.city, d.state].filter(Boolean).join(', '), d.zip].filter(x => x && x.trim()).join(' · ') || 'Location TBA';
  const tickets = d.is_paid
    ? p.preview.ticket_types.map(tt => `${tt.name} ${formatCents(tt.price_cents)}`).join(', ') || 'No ticket types yet'
    : 'Free RSVP';

  return (
    <View style={{ gap: t.space.lg }}>
      <View style={{ alignItems: 'center' }}>
        <EventCard event={p.preview} variant="carousel" width={Math.min(width - 32, 420)} onPress={() => undefined} />
      </View>

      <Card padded={false} style={{ paddingHorizontal: t.space.md }}>
        <SummaryRow label="When" value={d.start ? `${formatDateLong(d.start.toISOString())}\n${formatTimeRange(d.start.toISOString(), d.end?.toISOString())}` : 'Not set'} />
        <SummaryRow label="Where" value={where} />
        <SummaryRow label="Format" value={eventFormatLabel(d.format)} />
        <SummaryRow label="Audience" value={`${d.event_type} · ${d.age_group}`} />
        <SummaryRow label="Capacity" value={d.max_capacity ? `${d.max_capacity} guests` : 'Unlimited'} />
        <SummaryRow label="Tickets" value={tickets} />
        {d.online_url && d.format !== 'in_person' ? <SummaryRow label="Link" value={d.online_url} /> : null}
        <SummaryRow
          label="Publishing"
          value={d.schedule && d.publish_at ? `Scheduled for ${formatDateLong(d.publish_at.toISOString())}, ${formatTimeRange(d.publish_at.toISOString())}` : 'Goes live when you tap Publish'}
          last
        />
      </Card>

      {p.blockers.length > 0 ? (
        <Card style={{ borderColor: t.c.danger }}>
          <AppText variant="headline">Finish these to publish</AppText>
          <AppText variant="caption" tone="muted" style={{ marginBottom: 4 }}>
            You can still save a draft now.
          </AppText>
          {p.blockers.map((b, i) => (
            <RequirementRow
              key={b.key}
              icon="alert-circle-outline"
              tone="danger"
              title={b.title}
              body={b.body}
              onPress={b.route ? () => p.onBlockerPress(b.route as string) : undefined}
              last={i === p.blockers.length - 1}
            />
          ))}
        </Card>
      ) : null}

      {p.needsFee ? (
        <Card variant="featured" style={{ gap: t.space.sm }}>
          <View style={s.between}>
            <AppText variant="headline">Listing fee</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {p.finalCents !== LISTING_FEE_CENTS ? (
                <AppText variant="callout" tone="faint" style={{ textDecorationLine: 'line-through' }}>
                  {formatCents(LISTING_FEE_CENTS)}
                </AppText>
              ) : null}
              <AppText variant="title3" tone="gold">
                {p.finalCents === 0 ? 'Free' : formatCents(p.finalCents)}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" tone="muted">
            A one-time {formatCents(LISTING_FEE_CENTS)} listing fee applies to each paid event. Charged when you publish.
          </AppText>
          <View style={s.row}>
            <Field
              value={p.promo}
              onChangeText={v => p.onPromoChange(v.toUpperCase())}
              placeholder="Promo code"
              autoCapitalize="characters"
              autoCorrect={false}
              containerStyle={{ flex: 1 }}
              error={p.promoError}
              accessibilityLabel="Promo code"
            />
            <Button title="Apply" variant="secondary" onPress={p.onApplyPromo} loading={p.promoBusy} disabled={!p.promo.trim()} style={{ marginTop: 1 }} />
          </View>
          {p.finalCents !== LISTING_FEE_CENTS && !p.promoError ? <Badge label="Promo applied" tone="success" /> : null}
          {p.finalCents > 0 ? (
            <View style={{ gap: 6 }}>
              <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
                Card
              </AppText>
              <CardField
                postalCodeEnabled
                onCardChange={c => p.onCardComplete(c.complete)}
                cardStyle={{
                  backgroundColor: t.c.surface,
                  textColor: t.c.text,
                  placeholderColor: t.c.textFaint,
                  borderColor: t.c.border,
                  borderWidth: 1,
                  borderRadius: t.radius.md,
                  cursorColor: t.c.gold,
                  textErrorColor: t.c.danger,
                  fontSize: 15,
                }}
                style={{ width: '100%', height: 52 }}
                accessibilityLabel="Card details"
              />
            </View>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  sumRow: { flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: t.c.border },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', gap: t.space.xs, alignItems: 'flex-start' },
}));
