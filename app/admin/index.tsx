import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { adminActivity, adminOverview, adminRevenue, adminSignups, type AdminActivity, type AdminOverview } from '../../lib/api';
import { formatCents } from '../../lib/fees';
import { timeAgo } from '../../lib/format';
import { AppText, Card, EmptyState, ListGroup, ListRow, Screen, Skeleton, SkeletonGroup, StatTile } from '../../components/ui';
import { ADMIN_SECTIONS } from '../../components/admin/sections';
import { useLoad } from '../../components/admin/useLoad';
import { AdminGate } from '../../components/admin/AdminGate';
import { lastDays } from '../../lib/admin';

interface Dashboard {
  overview: AdminOverview;
  signups: number[];
  revenue: number[];
  activity: AdminActivity[];
}

export default function AdminScreen() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const fn = useCallback(async (): Promise<Dashboard> => {
    const [overview, signups, revenue, activity] = await Promise.all([adminOverview(token), adminSignups(token), adminRevenue(token), adminActivity(token)]);
    return {
      overview,
      signups: lastDays(signups.data, r => r.signups),
      revenue: lastDays(revenue.data, r => r.revenue_cents),
      activity: activity.activity,
    };
  }, [token]);
  const state = useLoad(fn);
  const o = state.data?.overview;
  const open = (key: string) => router.push(`/admin/${key}`);

  return (
    <Screen title="Admin" back>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        {state.loading ? (
          <SkeletonGroup>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} width="47%" height={96} radius={t.radius.lg} />
              ))}
            </View>
          </SkeletonGroup>
        ) : state.error || !o ? (
          <EmptyState compact art="cross" title="Couldn’t load the dashboard" body={state.error ?? undefined} actionLabel="Try again" onAction={state.reload} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              <StatTile label="Members" value={o.total_users.toLocaleString()} trend={state.data?.signups} onPress={() => open('users')} />
              <StatTile label="New this week" value={o.new_users_7d.toLocaleString()} tone="success" onPress={() => open('users')} />
              <StatTile label="Ticket sales" value={formatCents(o.total_revenue_cents)} trend={state.data?.revenue} tone="gold" onPress={() => open('payouts')} />
              <StatTile label="Platform fees" value={formatCents(o.total_platform_fee_cents)} onPress={() => open('payouts')} />
              <StatTile label="Live events" value={o.published_events.toLocaleString()} onPress={() => open('events')} />
              <StatTile label="All events" value={o.total_events.toLocaleString()} onPress={() => open('events')} />
              <StatTile label="Tickets sold" value={o.total_tickets_sold.toLocaleString()} onPress={() => open('events')} />
              <StatTile label="RSVPs" value={o.total_rsvps.toLocaleString()} onPress={() => open('events')} />
            </View>

            {o.open_reports || o.pending_verifications ? (
              <ListGroup title="Needs attention">
                {o.open_reports ? (
                  <ListRow icon="flag-outline" title={`${o.open_reports} open report${o.open_reports === 1 ? '' : 's'}`} subtitle="Respond within 24 hours" onPress={() => open('reports')} last={!o.pending_verifications} />
                ) : null}
                {o.pending_verifications ? (
                  <ListRow
                    icon="id-card-outline"
                    title={`${o.pending_verifications} host verification${o.pending_verifications === 1 ? '' : 's'} waiting`}
                    onPress={() => open('verifications')}
                    last
                  />
                ) : null}
              </ListGroup>
            ) : null}
          </>
        )}

        <ListGroup title="Manage">
          {ADMIN_SECTIONS.map((sec, i) => (
            <ListRow key={sec.key} icon={sec.icon} title={sec.title} subtitle={sec.subtitle} onPress={() => open(sec.key)} last={i === ADMIN_SECTIONS.length - 1} />
          ))}
        </ListGroup>

        {state.data?.activity.length ? (
          <Card style={{ gap: t.space.sm }}>
            <AppText variant="title3">Recent activity</AppText>
            {state.data.activity.slice(0, 12).map((a, i) => (
              <View key={`${a.type}-${i}`} style={{ gap: 2 }}>
                <AppText variant="callout">{a.text}</AppText>
                <AppText variant="caption" tone="muted">
                  {[a.time ? timeAgo(a.time) : null, a.sub].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
