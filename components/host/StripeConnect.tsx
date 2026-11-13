/**
 * Stripe Connect embedded components on iOS/Android (StripeConnect.web.tsx is the website version). Hosts set up and
 * manage payouts inside Christ Link: no redirect, no Stripe sign-in (accounts have no Stripe dashboard; backend
 * PaymentsService.ensureConnectAccount). The client secret comes from POST /api/connect/account-session.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConnectAccountOnboarding, ConnectComponentsProvider, ConnectPayouts, loadConnectAndInitialize } from '@stripe/stripe-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { createConnectSession } from '../../lib/api';
import { STRIPE_PK } from '../../lib/constants';
import { connectAppearance } from '../../lib/connectAppearance';
import { AppText, IconButton } from '../ui';

/** Expo Go ships its own native Stripe module without the Connect views, so it uses Stripe's hosted page instead. */
export const CONNECT_EMBEDDED = !!STRIPE_PK && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const FONT = '"Instrument Sans", -apple-system, system-ui, sans-serif';
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

/** Stripe's onboarding form, full screen. Collects everything due now and soon, so hosts aren't asked twice. */
export function PayoutSetup({ onExit, onLoadError }: { onExit: () => void; onLoadError?: () => void }) {
  return (
    <ConnectAccountOnboarding
      title="Set up payouts"
      onExit={onExit}
      onLoadError={onLoadError}
      collectionOptions={{ fields: 'eventually_due', futureRequirements: 'include' }}
    />
  );
}

/** Balance, payout history, schedule and bank account, in a sheet. */
export function PayoutHistory({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.space.md,
            paddingTop: t.space.sm,
            paddingBottom: t.space.xs,
          }}
        >
          <AppText variant="headline">Payouts</AppText>
          <IconButton icon="close" label="Close payouts" onPress={onClose} />
        </View>
        <ConnectPayouts style={{ flex: 1, marginBottom: insets.bottom }} />
      </View>
    </Modal>
  );
}

/** Stripe's "action required" notices are part of PayoutSetup on phones; the website shows them inline. */
export function PayoutNotices() {
  return null;
}
