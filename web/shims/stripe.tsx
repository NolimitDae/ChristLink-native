/**
 * Web build of @stripe/stripe-react-native (metro.config.js maps the package here for web only; iOS/Android use the
 * real SDK). Same calls the app makes, backed by Stripe.js:
 *  - initPaymentSheet + presentPaymentSheet → a payment dialog with Stripe's Payment Element (cards, Apple Pay /
 *    Google Pay where the browser and the Stripe domain registration allow, 3-D Secure in place)
 *  - CardField + createPaymentMethod → Stripe's card Element (host listing fee)
 * In the demo preview (EXPO_PUBLIC_DEMO=1) payments explain that they're unavailable instead.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe, StripeCardElement, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCents } from '../../lib/fees';
import { appearanceFor, cardStyleFor, type SheetAppearance } from './stripeAppearance';

type StripeError = { code: string; message: string };
type Result = { error?: StripeError };

export const PaymentSheetError = { Canceled: 'Canceled', Failed: 'Failed', Timeout: 'Timeout' } as const;

const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
const unavailable = (): StripeError => ({
  code: 'Failed',
  message: DEMO ? 'Payments work in the live app. This preview uses sample data.' : 'Payments are unavailable right now.',
});

interface SheetParams {
  paymentIntentClientSecret?: string;
  merchantDisplayName?: string;
  defaultBillingDetails?: { email?: string; name?: string };
  style?: 'alwaysDark' | 'alwaysLight' | 'automatic';
  appearance?: SheetAppearance;
}

interface Ctx {
  stripe: Promise<Stripe | null>;
  params: React.MutableRefObject<SheetParams | null>;
  open: (resolve: (r: Result) => void) => void;
  card: React.MutableRefObject<StripeCardElement | null>;
}

const StripeCtx = createContext<Ctx | null>(null);

export function StripeProvider({ publishableKey, children }: { publishableKey?: string; children: React.ReactNode }) {
  const stripe = useMemo(() => (publishableKey && !DEMO ? loadStripe(publishableKey) : Promise.resolve(null)), [publishableKey]);
  const params = useRef<SheetParams | null>(null);
  const card = useRef<StripeCardElement | null>(null);
  const [pending, setPending] = useState<{ resolve: (r: Result) => void } | null>(null);
  const ctx = useMemo<Ctx>(() => ({ stripe, params, card, open: resolve => setPending({ resolve }) }), [stripe]);

  const done = useCallback(
    (r: Result) => {
      pending?.resolve(r);
      setPending(null);
    },
    [pending],
  );

  return (
    <StripeCtx.Provider value={ctx}>
      {children}
      {pending && params.current ? <PaymentDialog stripePromise={stripe} params={params.current} onDone={done} /> : null}
    </StripeCtx.Provider>
  );
}

export function useStripe() {
  const ctx = useContext(StripeCtx);
  return useMemo(
    () => ({
      initPaymentSheet: async (p: SheetParams): Promise<Result> => {
        if (!ctx || !(await ctx.stripe)) return { error: unavailable() };
        if (!p.paymentIntentClientSecret) return { error: { code: 'Failed', message: 'Could not start checkout.' } };
        ctx.params.current = p;
        return {};
      },
      presentPaymentSheet: (): Promise<Result> =>
        new Promise(resolve => {
          if (!ctx?.params.current) resolve({ error: unavailable() });
          else ctx.open(resolve);
        }),
      createPaymentMethod: async (p: {
        paymentMethodType?: string;
        paymentMethodData?: { billingDetails?: { email?: string; name?: string } };
      }): Promise<{ paymentMethod?: { id: string }; error?: StripeError }> => {
        const stripe = ctx ? await ctx.stripe : null;
        if (!stripe) return { error: unavailable() };
        if (!ctx?.card.current) return { error: { code: 'Failed', message: 'Enter your card details.' } };
        const billing = p.paymentMethodData?.billingDetails;
        const { paymentMethod, error } = await stripe.createPaymentMethod({
          type: 'card',
          card: ctx.card.current,
          billing_details: { email: billing?.email, name: billing?.name },
        });
        if (error || !paymentMethod) return { error: { code: 'Failed', message: error?.message ?? 'Your card could not be processed.' } };
        return { paymentMethod: { id: paymentMethod.id } };
      },
      isPlatformPaySupported: async () => false,
      confirmPayment: async (): Promise<Result> => ({ error: unavailable() }),
    }),
    [ctx],
  );
}

/** A plain DOM node for Stripe to mount its secure iframe into. */
function Mount({ onNode, minHeight }: { onNode: (el: HTMLDivElement | null) => void; minHeight?: number }) {
  return React.createElement('div', { ref: onNode, style: { width: '100%', minHeight } });
}

/** The payment dialog presentPaymentSheet opens: Stripe's Payment Element, the amount on the button, inline errors. */
function PaymentDialog({ stripePromise, params, onDone }: { stripePromise: Promise<Stripe | null>; params: SheetParams; onDone: (r: Result) => void }) {
  const t = useTheme();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const elements = useRef<StripeElements | null>(null);
  const element = useRef<StripePaymentElement | null>(null);
  const node = useRef<HTMLDivElement | null>(null);
  const secret = params.paymentIntentClientSecret!;

  useEffect(() => {
    let alive = true;
    stripePromise.then(s => {
      if (!alive || !s || !node.current) return;
      setStripe(s);
      elements.current = s.elements({ clientSecret: secret, ...appearanceFor(params, t.scheme) });
      element.current = elements.current.create('payment', {
        layout: 'tabs',
        defaultValues: { billingDetails: { email: params.defaultBillingDetails?.email, name: params.defaultBillingDetails?.name } },
      });
      element.current.on('ready', () => alive && setReady(true));
      element.current.mount(node.current);
      s.retrievePaymentIntent(secret).then(({ paymentIntent }) => {
        if (alive && paymentIntent?.amount && paymentIntent.currency === 'usd') setAmount(formatCents(paymentIntent.amount));
      });
    });
    return () => {
      alive = false;
      element.current?.destroy();
    };
    // Mounted once per dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => {
    if (!paying) onDone({ error: { code: PaymentSheetError.Canceled, message: 'Canceled' } });
  };

  const pay = async () => {
    if (!stripe || !elements.current || paying) return;
    setPaying(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements: elements.current,
      redirect: 'if_required',
      // Only bank-redirect methods leave the page; they come back to Tickets, where the purchase is confirmed
      confirmParams: { return_url: `${(globalThis as { location?: { origin: string } }).location?.origin ?? ''}/tickets` },
    });
    setPaying(false);
    if (err) {
      setError(err.message ?? 'Your payment didn’t go through.');
      return;
    }
    if (paymentIntent && ['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) onDone({});
    else setError('Your payment didn’t go through.');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancel}>
      <View style={[styles.backdrop, { backgroundColor: t.c.scrimStrong }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Cancel payment" />
        <View
          style={[styles.dialog, { backgroundColor: t.c.bgElevated, borderColor: t.c.border, borderRadius: t.radius.xl, padding: t.space.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <AppText variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
              Payment
            </AppText>
            <IconButton icon="close" label="Cancel payment" size={34} onPress={cancel} disabled={paying} />
          </View>
          {!ready ? (
            <View style={{ gap: t.space.sm }}>
              <Skeleton height={44} radius={t.radius.md} />
              <Skeleton height={44} radius={t.radius.md} />
              <Skeleton height={44} radius={t.radius.md} />
            </View>
          ) : null}
          <View style={ready ? null : styles.hidden}>
            <Mount onNode={el => (node.current = el)} />
          </View>
          {error ? (
            <AppText variant="callout" tone="danger" accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button title={amount ? `Pay ${amount}` : 'Pay'} size="lg" fullWidth loading={paying} disabled={!ready} onPress={pay} />
          <AppText variant="caption" tone="faint" align="center">
            Payments are processed securely by Stripe.
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

interface CardFieldProps {
  postalCodeEnabled?: boolean;
  onCardChange?: (c: { complete: boolean }) => void;
  cardStyle?: Parameters<typeof cardStyleFor>[0];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Stripe's card Element in the app's field styling; createPaymentMethod reads it. */
export function CardField({ postalCodeEnabled, onCardChange, cardStyle, style, accessibilityLabel }: CardFieldProps) {
  const ctx = useContext(StripeCtx);
  const node = useRef<HTMLDivElement | null>(null);
  const change = useRef(onCardChange);
  change.current = onCardChange;

  useEffect(() => {
    let alive = true;
    let el: StripeCardElement | null = null;
    if (!ctx) return undefined;
    ctx.stripe.then(s => {
      if (!alive || !s || !node.current) return;
      el = s.elements().create('card', { hidePostalCode: !postalCodeEnabled, style: cardStyleFor(cardStyle) });
      el.on('change', e => change.current?.({ complete: e.complete }));
      el.mount(node.current);
      ctx.card.current = el;
    });
    return () => {
      alive = false;
      if (el && ctx.card.current === el) ctx.card.current = null;
      el?.destroy();
    };
    // Mounted once; style changes (theme switch) re-mount via the key the caller already gives on remount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          justifyContent: 'center',
          paddingHorizontal: 14,
          backgroundColor: cardStyle?.backgroundColor,
          borderColor: cardStyle?.borderColor,
          borderWidth: cardStyle?.borderWidth ?? 1,
          borderRadius: cardStyle?.borderRadius,
        },
        style,
      ]}
    >
      <Mount onNode={el => (node.current = el)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 460, gap: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hidden: { position: 'absolute', opacity: 0, left: 0, right: 0 },
});
