import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ApiError, startConnectOnboarding, syncConnectStatus } from '../../lib/api';
import { formatCents, LISTING_FEE_CENTS } from '../../lib/fees';
import { AppText, Badge, Button, Card, EmptyState, Screen } from '../../components/ui';
import { errorMessage } from '../../components/host/errors';

type Status = 'none' | 'incomplete' | 'active';

function FeeItem({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.feeRow}>
      <View style={s.feeIcon}>
        <Ionicons name={icon} size={18} color={t.c.goldText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="callout" tone="muted">
          {body}
        </AppText>
      </View>
    </View>
  );
}

export default function PayoutsScreen() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const [platformIssue, setPlatformIssue] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const acct = profile?.host_stripe_accounts?.[0];
  const status: Status = !acct?.stripe_account_id ? 'none' : acct.payouts_enabled ? 'active' : 'incomplete';

  const sync = async (quiet = false) => {
    if (!token) return;
    setBusy('sync');
    try {
      await syncConnectStatus(token);
      await refreshProfile();
      if (!quiet) showToast('Status updated', 'success');
    } catch (err) {
      if (!quiet) showToast(errorMessage(err, 'Could not check status'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    if (!token) return;
    setBusy('connect');
    setPlatformIssue(null);
    try {
      const res = await startConnectOnboarding(token);
      if (res.platformSetup) {
        setPlatformIssue(res.error ?? 'Stripe Connect isn’t fully set up for Christ Link Social yet.');
        return;
      }
      if (!res.url) throw new Error(res.error ?? 'Stripe didn’t return a setup link.');
      const result = await WebBrowser.openAuthSessionAsync(res.url, 'christlink://').catch(() => WebBrowser.openBrowserAsync(res.url as string));
      if (result.type === 'success' || result.type === 'cancel' || result.type === 'dismiss' || result.type === 'opened') {
        setBusy('sync');
        await syncConnectStatus(token).catch(() => undefined);
        await refreshProfile();
      }
    } catch (err) {
      if (err instanceof ApiError && err.body?.platformSetup) setPlatformIssue(errorMessage(err));
      else showToast(errorMessage(err, 'Could not open Stripe'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await sync(true);
    setRefreshing(false);
  };

  if (!session) {
    return (
      <Screen title="Payouts" back>
        <EmptyState art="ticket" title="Get paid for your events" body="Sign in to connect payouts." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  const statusCopy = {
    none: { badge: 'Not connected', tone: 'neutral' as const, title: 'Connect payouts', body: 'Connect a Stripe Express account so ticket sales are paid out to your bank.' },
    incomplete: { badge: 'Onboarding incomplete', tone: 'gold' as const, title: 'Finish Stripe setup', body: 'Stripe needs a few more details before it can send payouts. It only takes a few minutes.' },
    active: { badge: 'Payouts active', tone: 'success' as const, title: 'You’re ready to sell tickets', body: 'Ticket revenue is paid out to your bank on Stripe’s schedule.' },
  }[status];

  return (
    <Screen title="Payouts" back>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <Card variant={status === 'active' ? 'standard' : 'featured'} style={[{ gap: t.space.sm }, status === 'active' ? { borderColor: t.c.success, backgroundColor: t.c.successDim } : null]}>
          <View style={s.statusTop}>
            <View style={[s.statusIcon, { backgroundColor: status === 'active' ? t.c.success : t.c.goldDim }]}>
              <Ionicons name={status === 'active' ? 'checkmark' : status === 'incomplete' ? 'hourglass-outline' : 'card-outline'} size={22} color={status === 'active' ? t.c.bg : t.c.goldText} />
            </View>
            <Badge label={statusCopy.badge} tone={statusCopy.tone} />
          </View>
          <AppText variant="title2">{statusCopy.title}</AppText>
          <AppText variant="callout" tone="muted">
            {statusCopy.body}
          </AppText>
          {status === 'active' && acct?.charges_enabled === false ? (
            <AppText variant="caption" tone="danger">
              Stripe has paused card charges on your account. Open Stripe to resolve it.
            </AppText>
          ) : null}
          <View style={{ gap: t.space.xs, marginTop: t.space.xs }}>
            <Button
              title={status === 'none' ? 'Connect with Stripe' : status === 'incomplete' ? 'Finish Stripe setup' : 'Manage in Stripe'}
              variant={status === 'active' ? 'secondary' : 'primary'}
              icon={status === 'active' ? 'open-outline' : 'arrow-forward-circle-outline'}
              size="lg"
              fullWidth
              onPress={connect}
              loading={busy === 'connect'}
              disabled={busy !== null}
            />
            {status !== 'none' ? (
              <Button title="Check status" variant="ghost" icon="refresh" fullWidth onPress={() => sync()} loading={busy === 'sync'} disabled={busy !== null} />
            ) : null}
          </View>
        </Card>

        {platformIssue ? (
          <Card style={{ borderColor: t.c.danger, gap: 6 }}>
            <AppText variant="headline">Payouts aren’t available yet</AppText>
            <AppText variant="callout" tone="muted">
              The platform owner still needs to finish the Stripe Connect platform profile before hosts can connect. You can keep creating free events in the meantime.
            </AppText>
            <AppText variant="caption" tone="faint">
              {platformIssue}
            </AppText>
          </Card>
        ) : null}

        <Card style={{ gap: t.space.md }}>
          <AppText variant="title3">How fees work</AppText>
          <FeeItem icon="people-outline" title="Attendees pay a 7% service fee" body="Added on top of your ticket price at checkout. It keeps Christ Link Social running." />
          <FeeItem
            icon="cash-outline"
            title="You receive face value"
            body="Minus card processing (2.9% + 30¢), unless you choose to pass processing on to attendees when you create the event."
          />
          <FeeItem icon="pricetag-outline" title={`${formatCents(LISTING_FEE_CENTS)} listing fee`} body="A one-time fee per paid event, charged when you publish. Free events are always free." />
          <FeeItem icon="calendar-outline" title="Payouts on Stripe’s schedule" body="Usually a few business days after each sale. Stripe handles tax forms and bank details securely." />
        </Card>

        <Card variant="outline" style={{ gap: t.space.sm }}>
          <AppText variant="headline">Payout history</AppText>
          <AppText variant="callout" tone="muted">
            Payout history is available in your Stripe Express dashboard.
          </AppText>
          <Button title="Manage in Stripe" variant="secondary" icon="open-outline" onPress={connect} disabled={busy !== null || status === 'none'} />
        </Card>

        <Button title="Verify your identity" variant="ghost" icon="id-card-outline" onPress={() => router.push('/host/verify')} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  feeRow: { flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' },
  feeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.goldDim },
}));
