import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PaymentSheetError, useStripe } from '@stripe/stripe-react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  confirmTicketByIntent,
  createPaymentIntent,
  getPriceBreakdown,
  getTaxEstimate,
  validateCoupon,
} from '../../lib/api';
import { STRIPE_PK } from '../../lib/constants';
import { computeBreakdown, formatCents, paymentIntentIdFromSecret } from '../../lib/fees';
import { haptic } from '../../lib/haptics';
import { logger } from '../../lib/logger';
import type { Event, ServerPriceBreakdown, TicketType } from '../../lib/types';
import { AppText } from '../ui/AppText';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

interface CheckoutSheetProps {
  visible: boolean;
  onClose: () => void;
  event: Event;
  onPurchased: (ticketCode: string | undefined, qty: number) => void;
}

interface AppliedCoupon {
  code: string;
  label: string;
  discount: number;
}

const MAX_PER_ORDER = 10;

function remainingFor(tt: TicketType): number {
  if (tt.quantity === null || tt.quantity === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, tt.quantity - (tt.tickets_sold ?? 0));
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function CheckoutSheet({ visible, onClose, event, onPurchased }: CheckoutSheetProps) {
  const t = useTheme();
  const s = useStyles();
  const { session, user } = useAuth();
  const token = session?.access_token;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const types = event.ticket_types;
  const firstAvailable = types.find(tt => remainingFor(tt) > 0) ?? types[0];
  const [typeId, setTypeId] = useState<string | undefined>(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [server, setServer] = useState<ServerPriceBreakdown | null>(null);
  const [tax, setTax] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payingRef = useRef(false);
  const quoteSeq = useRef(0);

  const selected = types.find(tt => tt.id === typeId) ?? firstAvailable;
  const remaining = selected ? remainingFor(selected) : 0;
  const maxQty = Math.max(1, Math.min(MAX_PER_ORDER, remaining));
  const price = selected?.price_cents ?? 0;
  const absorb = event.absorb_stripe_fee !== false;
  const gross = price * qty;
  const discount = coupon?.discount ?? 0;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    const fresh = types.find(tt => tt.id === typeId);
    if (!fresh || remainingFor(fresh) <= 0) setTypeId(firstAvailable?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (qty > maxQty) setQty(maxQty);
  }, [qty, maxQty]);

  const estimate = useMemo(() => {
    try {
      return computeBreakdown(price, qty, absorb, discount);
    } catch {
      return null;
    }
  }, [price, qty, absorb, discount]);

  useEffect(() => {
    if (!visible || !selected) return;
    const seq = ++quoteSeq.current;
    setServer(null);
    setTax(0);
    const face = Math.max(0, gross - discount);
    if (face === 0) return;
    const timer = setTimeout(async () => {
      try {
        // Fees are charged on the order total, so a discounted order is quoted as one unit of the discounted face.
        const quote = discount > 0 ? await getPriceBreakdown(face, 1, absorb) : await getPriceBreakdown(price, qty, absorb);
        if (seq === quoteSeq.current) setServer(quote);
      } catch (err) {
        logger.warn('Price breakdown failed', { error: String(err) });
      }
      if (!token) return;
      try {
        const taxCents = await getTaxEstimate(face, token);
        if (seq === quoteSeq.current) setTax(taxCents);
      } catch (err) {
        logger.warn('Tax estimate failed', { error: String(err) });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, selected, price, qty, absorb, gross, discount, token]);

  const applyCoupon = async (raw = code) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await validateCoupon(event.id, trimmed, price, qty);
      const off = Math.max(0, gross - res.newTotal);
      setCoupon({ code: trimmed, label: res.label, discount: off });
      haptic.success();
    } catch (err) {
      setCoupon(null);
      setCouponError(errorMessage(err, 'That code isn’t valid'));
      haptic.error();
    } finally {
      setCouponBusy(false);
    }
  };

  const couponKey = `${typeId}:${qty}`;
  const lastCouponKey = useRef(couponKey);
  useEffect(() => {
    if (lastCouponKey.current === couponKey) return;
    lastCouponKey.current = couponKey;
    if (coupon) applyCoupon(coupon.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponKey]);

  const cutoffPassed = !!event.sales_cutoff && Date.now() > new Date(event.sales_cutoff).getTime();
  const allSoldOut = types.length > 0 && types.every(tt => remainingFor(tt) <= 0);
  const isFreeOrder = !!estimate && estimate.chargeAmount === 0;
  const blockedReason = cutoffPassed
    ? 'Ticket sales have ended for this event.'
    : allSoldOut
      ? 'This event is sold out.'
      : !selected
        ? 'Tickets aren’t on sale yet.'
        : remaining <= 0
          ? 'This ticket type is sold out.'
          : !STRIPE_PK && !isFreeOrder
            ? 'Payments unavailable right now. Please try again later.'
            : null;

  const platformFee = server?.platformFee ?? estimate?.platformFee ?? 0;
  const stripeFee = server?.stripeFee ?? estimate?.stripeFee ?? 0;
  const charge = server?.chargeAmount ?? estimate?.chargeAmount ?? 0;
  const total = charge + (charge > 0 ? tax : 0);

  const finish = (ticketCode: string | undefined) => {
    haptic.success();
    setCoupon(null);
    setCode('');
    setQty(1);
    onClose();
    onPurchased(ticketCode, qty);
  };

  const pay = async () => {
    if (payingRef.current || blockedReason || !selected || !token) return;
    payingRef.current = true;
    setPaying(true);
    setError(null);
    try {
      const res = await createPaymentIntent(
        { eventId: event.id, ticketTypeId: selected.id, qty, buyerEmail: user?.email, couponCode: coupon?.code ?? null },
        token,
      );
      if (res.error) throw new Error(res.error);
      if (res.free) {
        finish(res.ticketCode);
        return;
      }
      if (!res.clientSecret) throw new Error('Could not start checkout. Please try again.');
      if (!STRIPE_PK) throw new Error('Payments unavailable right now.');
      const init = await initPaymentSheet({
        paymentIntentClientSecret: res.clientSecret,
        merchantDisplayName: 'Christ Link Social',
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
        defaultBillingDetails: { email: user?.email },
        returnURL: 'christlink://stripe-redirect',
        style: t.scheme === 'dark' ? 'alwaysDark' : 'alwaysLight',
        appearance: {
          shapes: { borderRadius: t.radius.md },
          colors: {
            primary: t.c.gold,
            background: t.c.bgElevated,
            componentBackground: t.c.surface,
            componentBorder: t.c.surface3,
            componentDivider: t.c.surface3,
            primaryText: t.c.text,
            secondaryText: t.c.textMuted,
            componentText: t.c.text,
            placeholderText: t.c.textFaint,
            icon: t.c.goldText,
            error: t.c.danger,
          },
          primaryButton: {
            colors: { background: t.c.gold, text: t.c.onGold },
            shapes: { borderRadius: t.radius.pill },
          },
        },
      });
      if (init.error) throw new Error(init.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code !== PaymentSheetError.Canceled) {
          setError(presented.error.message || 'Your payment didn’t go through.');
          haptic.error();
        }
        return;
      }
      const intentId = paymentIntentIdFromSecret(res.clientSecret);
      if (intentId) {
        await confirmTicketByIntent(intentId, token).catch(err => logger.warn('confirm-by-intent failed', { error: String(err) }));
      }
      finish(res.ticketCode);
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. You have not been charged.'));
      haptic.error();
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const payLabel = isFreeOrder ? 'Get free ticket' : `Pay ${formatCents(total)}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={paying ? () => undefined : onClose}
      title="Get tickets"
      subtitle={event.name}
      footer={
        <View style={{ gap: 8 }}>
          {blockedReason ? (
            <AppText variant="caption" tone="muted" align="center">
              {blockedReason}
            </AppText>
          ) : null}
          <Button title={payLabel} icon={isFreeOrder ? 'ticket-outline' : 'lock-closed'} onPress={pay} loading={paying} disabled={!!blockedReason} fullWidth size="lg" />
          {!isFreeOrder && !blockedReason ? (
            <AppText variant="caption" tone="faint" align="center">
              {STRIPE_PK.startsWith('pk_test_') ? 'Secure checkout by Stripe · Test mode' : 'Secure checkout by Stripe'}
            </AppText>
          ) : null}
        </View>
      }
    >
      <AppText variant="overline" tone="muted" style={s.label}>
        Ticket type
      </AppText>
      <View style={{ gap: t.space.xs }}>
        {types.map(tt => {
          const left = remainingFor(tt);
          const soldOut = left <= 0;
          const active = tt.id === selected?.id;
          return (
            <Pressable
              key={tt.id}
              disabled={soldOut || paying}
              onPress={() => {
                haptic.tap();
                setTypeId(tt.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: soldOut }}
              accessibilityLabel={`${tt.name}, ${formatCents(tt.price_cents, { free: 'Free' })}${soldOut ? ', sold out' : ''}`}
              style={[
                s.typeCard,
                { borderColor: active ? t.c.gold : t.c.border, backgroundColor: active ? t.c.goldDim : t.c.surface, opacity: soldOut ? 0.5 : 1 },
              ]}
            >
              <View style={[s.radio, { borderColor: active ? t.c.gold : t.c.borderStrong }]}>
                {active ? <View style={[s.radioDot, { backgroundColor: t.c.gold }]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{tt.name}</AppText>
                {tt.description ? (
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {tt.description}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone={soldOut ? 'danger' : left <= 10 ? 'gold' : 'faint'} style={{ marginTop: 2 }}>
                  {soldOut ? 'Sold out' : Number.isFinite(left) ? `${left} left` : 'Available'}
                </AppText>
              </View>
              <AppText variant="headline">{formatCents(tt.price_cents, { free: 'Free' })}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={s.qtyRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Quantity</AppText>
          <AppText variant="caption" tone="faint">
            Up to {maxQty} per order
          </AppText>
        </View>
        <View style={[s.stepper, { borderColor: t.c.border, backgroundColor: t.c.surface }]}>
          <StepButton icon="remove" label="Decrease quantity" disabled={qty <= 1 || paying} onPress={() => setQty(q => Math.max(1, q - 1))} />
          <AppText variant="headline" style={s.qtyValue} accessibilityLiveRegion="polite" accessibilityLabel={`Quantity ${qty}`}>
            {qty}
          </AppText>
          <StepButton icon="add" label="Increase quantity" disabled={qty >= maxQty || paying} onPress={() => setQty(q => Math.min(maxQty, q + 1))} />
        </View>
      </View>

      {price > 0 ? (
        <View style={s.couponRow}>
          <Field
            containerStyle={{ flex: 1 }}
            placeholder="Promo code"
            value={code}
            onChangeText={v => {
              setCode(v);
              setCouponError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => applyCoupon()}
            error={couponError}
            hint={coupon ? `${coupon.label} applied` : undefined}
            accessibilityLabel="Promo code"
            editable={!paying}
          />
          <Button title={coupon && coupon.code === code.trim().toUpperCase() ? 'Applied' : 'Apply'} variant="secondary" onPress={() => applyCoupon()} loading={couponBusy} disabled={!code.trim() || paying} style={{ marginTop: 1 }} />
        </View>
      ) : null}

      <View style={[s.summary, { borderColor: t.c.border, backgroundColor: t.c.surface }]}>
        <Line label={`${qty} × ${selected?.name ?? 'Ticket'}`} value={formatCents(gross)} />
        {discount > 0 ? <Line label={coupon?.label ?? 'Discount'} value={formatCents(-discount)} tone="success" /> : null}
        {charge > 0 ? <Line label="Service fee (7%)" value={formatCents(platformFee)} /> : null}
        {charge > 0 && !absorb ? <Line label="Processing" value={formatCents(stripeFee)} /> : null}
        {charge > 0 && tax > 0 ? <Line label="Estimated tax" value={formatCents(tax)} /> : null}
        <View style={[s.divider, { backgroundColor: t.c.border }]} />
        <View style={s.lineRow}>
          <AppText variant="headline">Total</AppText>
          <AppText variant="title3" accessibilityLabel={`Total ${formatCents(total)}`}>
            {formatCents(total, { free: 'Free' })}
          </AppText>
        </View>
        {!server && charge > 0 ? (
          <AppText variant="caption" tone="faint">
            Estimate · confirming with server
          </AppText>
        ) : null}
      </View>

      {error ? (
        <View style={[s.error, { backgroundColor: t.c.dangerDim, borderColor: t.c.danger }]} accessibilityLiveRegion="assertive">
          <Ionicons name="alert-circle" size={18} color={t.c.danger} />
          <AppText variant="callout" tone="danger" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={t.c.goldText} />
    </Pressable>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <View style={styles.line}>
      <AppText variant="callout" tone={tone ?? 'muted'} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="callout" tone={tone ?? 'default'}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
});

const useStyles = makeStyles(t => ({
  label: { marginBottom: t.space.xs },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, padding: t.space.sm + 2, borderRadius: t.radius.md, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: t.space.lg, gap: t.space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: t.radius.pill, paddingHorizontal: 2 },
  qtyValue: { minWidth: 28, textAlign: 'center' },
  couponRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xs, marginTop: t.space.lg },
  summary: { marginTop: t.space.lg, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: 1, gap: 2 },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: t.space.xs },
  error: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginTop: t.space.md, padding: t.space.sm, borderRadius: t.radius.md, borderWidth: StyleSheet.hairlineWidth },
}));
