import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { adminPayouts } from '../../lib/api';
import { formatCents } from '../../lib/fees';
import { formatDateShort } from '../../lib/format';
import { AppText, Badge, Card, StatTile } from '../ui';
import { PanelState } from './PanelState';
import { useLoad } from './useLoad';

function statusTone(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'failed' || status === 'canceled') return 'danger' as const;
  return 'neutral' as const;
}

/** After-event host payouts (worker job host-payouts): what's held, what's due, and each payout. */
export function PayoutsPanel() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const fn = useCallback(() => adminPayouts(token), [token]);
  const state = useLoad(fn);
  const d = state.data;

  return (
    <ScrollView
      contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
    >
      {d ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            <StatTile label="Held for upcoming events" value={formatCents(d.held_cents)} />
            <StatTile label="Due now" value={formatCents(d.due_cents)} tone="gold" />
          </View>
          <AppText variant="caption" tone="muted">
            Hosts are paid automatically the day after their event ends (checked every hour). “Due now” waits for Stripe to make card funds available,
            usually about two days after a sale.
          </AppText>
        </>
      ) : null}
      <PanelState state={state} art="ticket" emptyTitle="No payouts yet" emptyBody="Payouts appear here after the first paid event ends." isEmpty={x => x.payouts.length === 0} />
      {(d?.payouts ?? []).map(p => (
        <Card key={p.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {p.host?.full_name || p.host?.email || 'Host'}
            </AppText>
            <AppText variant="bodyStrong">{formatCents(p.amount_cents)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Badge label={p.status.replace('_', ' ')} tone={statusTone(p.status)} />
            <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {[formatDateShort(p.created_at), p.stripe_payout_id].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          {p.error ? (
            <AppText variant="caption" tone="danger">
              {p.error}
            </AppText>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
