import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { computeBreakdown, formatCents } from '../../lib/fees';
import type { TicketType } from '../../lib/types';
import { AppText, Button, Card, Field, IconButton, ListRow, Segmented } from '../ui';
import { CheckRow } from './CheckRow';
import { Label } from './CreateBasics';
import { newTicket, ticketCents, type StepProps, type TicketDraft } from './eventDraft';
import { RequirementRow } from './RequirementCard';

interface TicketsProps extends StepProps {
  existingTickets: TicketType[];
  adultConfirmed: boolean;
  onAdultChange: (v: boolean) => void;
  identityOk: boolean;
  payoutsReady: boolean;
  hasStripeAccount: boolean;
}

export function FeeLine({ cents, absorb }: { cents: number | null; absorb: boolean }) {
  if (cents === null || cents <= 0) return null;
  const b = computeBreakdown(cents, 1, absorb);
  return (
    <AppText variant="caption" tone="muted">
      Attendee pays <AppText variant="caption">{formatCents(b.chargeAmount)}</AppText> (incl. 7% service fee) · You receive{' '}
      <AppText variant="caption" tone="success">
        {formatCents(b.hostReceives)}
      </AppText>
    </AppText>
  );
}

export function CreateTickets(p: TicketsProps) {
  const { draft, update, errors, editing } = p;
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();

  const setTicket = (key: string, patch: Partial<TicketDraft>) =>
    update({ tickets: draft.tickets.map(tk => (tk.key === key ? { ...tk, ...patch } : tk)) });

  return (
    <View style={{ gap: t.space.lg }}>
      <Segmented
        options={[
          { value: 'free', label: 'Free' },
          { value: 'paid', label: 'Paid' },
        ]}
        value={draft.is_paid ? 'paid' : 'free'}
        onChange={v => !editing && update({ is_paid: v === 'paid' })}
      />
      {editing ? (
        <AppText variant="caption" tone="faint">
          Pricing can’t be switched after an event is created. Duplicate the event to change it.
        </AppText>
      ) : null}

      {!draft.is_paid ? (
        <Card variant="outline">
          <AppText variant="headline">Free RSVP</AppText>
          <AppText variant="callout" tone="muted" style={{ marginTop: 4 }}>
            Guests reserve a spot in one tap. No fees, no setup — you can publish right away.
          </AppText>
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="headline" style={{ marginBottom: 4 }}>
              Before you sell tickets
            </AppText>
            <CheckRow checked={p.adultConfirmed} onChange={p.onAdultChange} label="I confirm I am 18 or older and agree to the Host Agreement">
              <AppText variant="callout">
                I confirm I am 18 or older and agree to the{' '}
                <AppText variant="callout" tone="gold" onPress={() => router.push('/legal/host')} accessibilityRole="link">
                  Host Agreement
                </AppText>
              </AppText>
            </CheckRow>
            <RequirementRow
              icon="id-card-outline"
              title="Verify your identity"
              body={p.identityOk ? 'Verified' : 'Required before a paid event can go live'}
              done={p.identityOk}
              onPress={() => router.push('/host/verify')}
            />
            <RequirementRow
              icon="card-outline"
              title={p.hasStripeAccount ? 'Finish Stripe setup' : 'Set up payouts'}
              body={p.payoutsReady ? 'Payouts active' : 'Connect Stripe so ticket sales reach your bank'}
              done={p.payoutsReady}
              onPress={() => router.push('/host/payouts')}
              last
            />
          </Card>

          {editing ? (
            <View style={{ gap: t.space.sm }}>
              <Label hint="Ticket types can’t be edited after creation.">Ticket types</Label>
              {p.existingTickets.length === 0 ? (
                <AppText variant="callout" tone="muted">
                  No ticket types yet.
                </AppText>
              ) : (
                p.existingTickets.map(tt => (
                  <Card key={tt.id} style={{ gap: 4 }}>
                    <View style={s.between}>
                      <AppText variant="bodyStrong">{tt.name}</AppText>
                      <AppText variant="bodyStrong">{formatCents(tt.price_cents)}</AppText>
                    </View>
                    <AppText variant="caption" tone="muted">
                      {tt.tickets_sold ?? 0} sold{tt.quantity ? ` of ${tt.quantity}` : ''}
                    </AppText>
                    <FeeLine cents={tt.price_cents} absorb={draft.absorb} />
                  </Card>
                ))
              )}
            </View>
          ) : (
            <View style={{ gap: t.space.sm }}>
              <Label>Ticket types</Label>
              {errors.tickets ? (
                <AppText variant="caption" tone="danger">
                  {errors.tickets}
                </AppText>
              ) : null}
              {draft.tickets.map((tk, i) => (
                <Card key={tk.key} style={{ gap: t.space.sm }}>
                  <View style={s.between}>
                    <AppText variant="overline" tone="gold">
                      Ticket {i + 1}
                    </AppText>
                    {draft.tickets.length > 1 ? (
                      <IconButton icon="trash-outline" label={`Remove ticket ${i + 1}`} size={34} tone="plain" color={t.c.danger} onPress={() => update({ tickets: draft.tickets.filter(x => x.key !== tk.key) })} />
                    ) : null}
                  </View>
                  <Field label="Name" value={tk.name} onChangeText={name => setTicket(tk.key, { name })} placeholder="General admission" error={errors[`ticket_name_${tk.key}`]} maxLength={60} />
                  <View style={s.row}>
                    <Field
                      label="Price"
                      value={tk.price}
                      onChangeText={price => setTicket(tk.key, { price })}
                      placeholder="15.00"
                      keyboardType="decimal-pad"
                      left={<AppText tone="muted">$</AppText>}
                      containerStyle={{ flex: 1 }}
                      error={errors[`ticket_price_${tk.key}`]}
                    />
                    <Field
                      label="Quantity"
                      value={tk.quantity}
                      onChangeText={quantity => setTicket(tk.key, { quantity: quantity.replace(/[^0-9]/g, '') })}
                      placeholder="Unlimited"
                      keyboardType="number-pad"
                      containerStyle={{ flex: 1 }}
                      error={errors[`ticket_qty_${tk.key}`]}
                    />
                  </View>
                  <FeeLine cents={ticketCents(tk)} absorb={draft.absorb} />
                </Card>
              ))}
              {draft.tickets.length < 6 ? (
                <Button title="Add ticket type" icon="add" variant="secondary" size="sm" onPress={() => update({ tickets: [...draft.tickets, newTicket()] })} style={{ alignSelf: 'flex-start' }} />
              ) : null}
            </View>
          )}

          <View style={s.group}>
            <ListRow
              icon="shield-checkmark-outline"
              title="I’ll cover card processing"
              subtitle={draft.absorb ? 'Processing (2.9% + 30¢) comes out of your payout' : 'Attendees pay processing on top of the price'}
              toggle={draft.absorb}
              onToggle={absorb => update({ absorb })}
              last
            />
          </View>
          <Pressable onPress={() => router.push('/host/payouts')} accessibilityRole="link" hitSlop={8}>
            <AppText variant="caption" tone="faint">
              Attendees always pay a 7% service fee. A one-time $19.99 listing fee applies per paid event.{' '}
              <AppText variant="caption" tone="gold">
                How payouts work
              </AppText>
            </AppText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', gap: t.space.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
