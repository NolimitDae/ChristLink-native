import React, { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
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
import { CONNECT_EMBEDDED, PayoutHistory, PayoutNotices, PayoutSetup, StripeConnect } from '../../components/host/StripeConnect';

type Status = 'none' | 'incomplete' | 'active';
/** Embedded Stripe views: on phones they open as full-screen sheets; on the website they replace the page body. */
type View_ = 'status' | 'setup' | 'history';

function FeeItem({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.feeRow}>
      <View style={s.feeIcon}>
        <Ionicons name={icon} size={20} color={t.c.textMuted} />
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
  const [view, setView] = useState<View_>('status');
  // The embedded components (and so the Stripe account) start only once the host asks for them
  const [embedStarted, setEmbedStarted] = useState(false);

  const acct = profile?.host_stripe_accounts?.[0];
  const status: Status = !acct?.stripe_account_id ? 'none' : acct.payouts_enabled ? 'active' : 'incomplete';

  const sync = useCallback(async (quiet = false) => {
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
  }, [token, refreshProfile, showToast]);

  const onEmbedError = useCallback(
    (err: unknown) => {
      setView('status');
      if (err instanceof ApiError && err.body?.platformSetup) setPlatformIssue(errorMessage(err));
      else showToast(errorMessage(err, 'Could not reach Stripe'), 'error');
    },
    [showToast],
  );

  const openEmbedded = (next: 'setup' | 'history') => {
    setPlatformIssue(null);
    setEmbedStarted(true);
    setView(next);
  };

  const closeSetup = () => {
    setView('status');
    void sync(true);
  };

  /** Stripe-hosted page: only where the embedded views can't run (Expo Go, missing key). */
  const connectHosted = async () => {
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
    none: {
      badge: 'Not set up',
      tone: 'neutral' as const,
      title: 'Get paid for ticket sales',
      body: 'Add your bank account and confirm your identity, right here. It takes about five minutes, and Stripe keeps your details secure.',
    },
    incomplete: { badge: 'Setup incomplete', tone: 'gold' as const, title: 'Finish payout setup', body: 'Stripe needs a few more details before it can send payouts. Pick up where you left off.' },
    active: { badge: 'Payouts active', tone: 'success' as const, title: 'You’re ready to sell tickets', body: 'Ticket revenue is paid out to your bank automatically, usually a few business days after each sale.' },
  }[status];

  // Existing accounts start the embedded views right away (so Stripe's notices can show); new ones wait for a tap
  const embedReady = embedStarted || (CONNECT_EMBEDDED && !!acct?.stripe_account_id);

  const setupOrHosted = () => (CONNECT_EMBEDDED ? openEmbedded('setup') : connectHosted());
  const historyOrHosted = () => (CONNECT_EMBEDDED ? openEmbedded('history') : connectHosted());
  // On the website the Stripe form takes the page; on phones it opens over it
  const inline = Platform.OS === 'web' && view !== 'status';

  const body = (
    <ScrollView
      contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
    >
      {inline && view === 'setup' ? <PayoutSetup onExit={closeSetup} onLoadError={() => setView('status')} /> : null}
      {inline && view === 'history' ? <PayoutHistory onClose={() => setView('status')} /> : null}
      {inline ? null : (
        <>
          {embedReady && status !== 'none' ? <PayoutNotices /> : null}
          <Card
            variant={status === 'active' ? 'standard' : 'featured'}
            style={[{ gap: t.space.sm }, status === 'active' ? { borderColor: t.c.success, backgroundColor: t.c.successDim } : null]}
          >
            <View style={s.statusTop}>
              <View style={[s.statusIcon, { backgroundColor: status === 'active' ? t.c.success : t.c.goldDim }]}>
                <Ionicons
                  name={status === 'active' ? 'checkmark' : status === 'incomplete' ? 'hourglass-outline' : 'wallet-outline'}
                  size={22}
                  color={status === 'active' ? t.c.bg : t.c.goldText}
                />
              </View>
              <Badge label={statusCopy.badge} tone={statusCopy.tone} />
            </View>
            <AppText variant="title2">{statusCopy.title}</AppText>
            <AppText variant="callout" tone="muted">
              {statusCopy.body}
            </AppText>
            {status === 'active' && acct?.charges_enabled === false ? (
              <AppText variant="caption" tone="danger">
                Stripe has paused card charges on your account. Open payout setup to see what it needs.
              </AppText>
            ) : null}
            <View style={{ gap: t.space.xs, marginTop: t.space.xs }}>
              {status === 'active' ? (
                <Button title="View payouts" variant="secondary" icon="wallet-outline" size="lg" fullWidth onPress={historyOrHosted} disabled={busy !== null} />
              ) : (
                <Button
                  title={status === 'none' ? 'Set up payouts' : 'Finish payout setup'}
                  size="lg"
                  fullWidth
                  onPress={setupOrHosted}
                  loading={busy === 'connect'}
                  disabled={busy !== null}
                />
              )}
              {status === 'active' && acct?.charges_enabled === false ? (
                <Button title="Open payout setup" variant="ghost" fullWidth onPress={setupOrHosted} disabled={busy !== null} />
              ) : null}
              {status !== 'none' ? (
                <Button title="Check status" variant="ghost" icon="refresh" fullWidth onPress={() => sync()} loading={busy === 'sync'} disabled={busy !== null} />
              ) : null}
            </View>
          </Card>

          {platformIssue ? (
            <Card style={{ borderColor: t.c.danger, gap: 6 }}>
              <AppText variant="headline">Payouts aren’t available yet</AppText>
              <AppText variant="callout" tone="muted">
                The platform owner still needs to finish the Stripe Connect platform profile before hosts can set up payouts. You can keep creating free events in the
                meantime.
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
            <FeeItem icon="calendar-outline" title="Automatic payouts" body="Usually a few business days after each sale, straight to the bank account you add here." />
          </Card>

          {status !== 'none' ? (
            <Card variant="outline" style={{ gap: t.space.sm }}>
              <AppText variant="headline">Payout history</AppText>
              <AppText variant="callout" tone="muted">
                Your balance, past payouts, payout schedule and bank account.
              </AppText>
              <Button title="View payouts" variant="secondary" onPress={historyOrHosted} disabled={busy !== null} />
            </Card>
          ) : null}

          <Button title="Verify your identity" variant="ghost" icon="id-card-outline" onPress={() => router.push('/host/verify')} />
        </>
      )}
      {!inline && view === 'setup' ? <PayoutSetup onExit={closeSetup} onLoadError={() => setView('status')} /> : null}
      {!inline && view === 'history' ? <PayoutHistory onClose={() => setView('status')} /> : null}
    </ScrollView>
  );

  return (
    <Screen title="Payouts" back>
      {embedReady && token ? (
        <StripeConnect token={token} onError={onEmbedError}>
          {body}
        </StripeConnect>
      ) : (
        body
      )}
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  feeRow: { flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' },
  feeIcon: { width: 28, alignItems: 'center', paddingTop: 2 },
}));
