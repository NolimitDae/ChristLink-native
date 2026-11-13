/**
 * Website version of components/host/StripeConnect.tsx: Stripe Connect embedded components (Connect.js) rendered in
 * the page, so hosts set up and manage payouts on christlinksocial.com without leaving it.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider, ConnectNotificationBanner, ConnectPayouts } from '@stripe/react-connect-js';
import { useTheme } from '../../contexts/ThemeContext';
import { createConnectSession } from '../../lib/api';
import { STRIPE_PK } from '../../lib/constants';
import { connectAppearance } from '../../lib/connectAppearance';
import { AppText, Button, Card } from '../ui';

const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
export const CONNECT_EMBEDDED = !!STRIPE_PK && !DEMO;

const FONT = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const FONTS = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap' }];

export function StripeConnect({ token, onError, children }: { token: string; onError?: (e: unknown) => void; children: React.ReactNode }) {
  const t = useTheme();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const instance = useMemo(
    () =>
      loadConnectAndInitialize({
        publishableKey: STRIPE_PK,
        fetchClientSecret: async () => {
          try {
            return (await createConnectSession(tokenRef.current)).client_secret;
          } catch (e) {
            onErrorRef.current?.(e);
            throw e;
          }
        },
        appearance: connectAppearance(t, FONT),
        fonts: FONTS,
      }),
    // One instance per screen; theme changes go through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    instance.update({ appearance: connectAppearance(t, FONT) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.scheme]);
  return <ConnectComponentsProvider connectInstance={instance}>{children}</ConnectComponentsProvider>;
}

function Panel({ title, onDone, doneLabel, children }: { title: string; onDone: () => void; doneLabel: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ gap: t.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
        <AppText variant="title3">{title}</AppText>
        <Button title={doneLabel} variant="ghost" size="sm" onPress={onDone} />
      </View>
      {children}
    </Card>
  );
}

/** Stripe's onboarding form, in the page. Collects everything due now and soon, so hosts aren't asked twice. */
export function PayoutSetup({ onExit, onLoadError }: { onExit: () => void; onLoadError?: () => void }) {
  return (
    <Panel title="Set up payouts" doneLabel="Save for later" onDone={onExit}>
      <ConnectAccountOnboarding
        onExit={onExit}
        onLoadError={onLoadError}
        collectionOptions={{ fields: 'eventually_due', futureRequirements: 'include' }}
      />
    </Panel>
  );
}

/** Balance, payout history, schedule and bank account. */
export function PayoutHistory({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Payouts" doneLabel="Done" onDone={onClose}>
      <ConnectPayouts />
    </Panel>
  );
}

/** Stripe's "action required" notices (only shows when Stripe needs something from the host). */
export function PayoutNotices() {
  return <ConnectNotificationBanner collectionOptions={{ fields: 'eventually_due', futureRequirements: 'include' }} />;
}
