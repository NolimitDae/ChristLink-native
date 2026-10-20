import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useToast } from '../../contexts/ToastContext';
import {
  chargeListingFee,
  createEvent,
  createTicketType,
  getEvent,
  publishEvent,
  scheduleEvent,
  updateEvent,
  updateTicketType,
  validateListingPromo,
} from '../../lib/api';
import { confirmHostAdult } from '../../lib/features';
import { LISTING_FEE_CENTS } from '../../lib/fees';
import { haptic } from '../../lib/haptics';
import type { Event } from '../../lib/types';
import { EventCard } from '../../components/EventCard';
import { AppText, Button, EmptyState, LightBurst, Screen, Skeleton, SkeletonGroup } from '../../components/ui';
import { StepProgress } from '../../components/host/StepProgress';
import { CreateBasics } from '../../components/host/CreateBasics';
import { CreateWhenWhere } from '../../components/host/CreateWhenWhere';
import { CreateTickets } from '../../components/host/CreateTickets';
import { CreateReview, type Blocker } from '../../components/host/CreateReview';
import { errorMessage, isNotSetUp } from '../../components/host/errors';
import {
  STEPS,
  draftFromEvent,
  draftToPayload,
  draftToPreviewEvent,
  emptyDraft,
  errorsForStep,
  firstErrorStep,
  ticketCents,
  validateDraft,
  type EventDraft,
} from '../../components/host/eventDraft';

type Busy = 'draft' | 'publish' | 'save' | null;

export default function CreateEventScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = !!editId;
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, profile, isVerifiedHost } = useAuth();
  const { settings, setSettings } = useAppData();
  const { showToast } = useToast();
  const { createPaymentMethod } = useStripe();
  const token = session?.access_token;

  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [existing, setExisting] = useState<Event | null>(null);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(true);
  const [adultConfirmed, setAdultConfirmed] = useState(!!settings?.host_adult_confirmed_at);
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [finalCents, setFinalCents] = useState(LISTING_FEE_CENTS);
  const [cardComplete, setCardComplete] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [burst, setBurst] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const createdId = useRef<string | null>(null);
  // Draft tier key → server tier, so a retry after a partial failure or declined fee never duplicates tiers.
  const createdTiers = useRef(new Map<string, { id: string; sent: string }>());
  const feePaid = useRef(false);

  useEffect(() => {
    if (settings?.host_adult_confirmed_at) setAdultConfirmed(true);
  }, [settings?.host_adult_confirmed_at]);

  const load = useCallback(async () => {
    if (!editId || !token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ev = await getEvent(editId, token);
      if (user && ev.host_id !== user.id) throw new Error('You can only edit events you host.');
      setExisting(ev);
      setDraft(draftFromEvent(ev));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load this event.'));
    } finally {
      setLoading(false);
    }
  }, [editId, token, user]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((patch: Partial<EventDraft>) => setDraft(prev => ({ ...prev, ...patch })), []);

  const allErrors = useMemo(() => validateDraft(draft, { editing }), [draft, editing]);
  const visibleErrors = useMemo(() => (attempted.has(step) ? errorsForStep(allErrors, step) : {}), [allErrors, attempted, step]);

  const acct = profile?.host_stripe_accounts?.[0];
  const payoutsReady = !!acct?.payouts_enabled;
  const listingPaid = !!existing?.listing_fee_paid || feePaid.current;
  const needsFee = draft.is_paid && !listingPaid;

  const preview = useMemo(
    () => draftToPreviewEvent(draft, user?.id ?? 'me', profile?.full_name ?? 'You', existing?.ticket_types),
    [draft, user?.id, profile?.full_name, existing?.ticket_types],
  );

  const blockers: Blocker[] = useMemo(() => {
    if (!draft.is_paid) return [];
    const out: Blocker[] = [];
    if (!adultConfirmed) out.push({ key: 'adult', title: 'Confirm the Host Agreement', body: 'Tick the 18+ confirmation on the Tickets step' });
    if (!isVerifiedHost) out.push({ key: 'id', title: 'Verify your identity', body: 'Required for paid events', route: '/host/verify' });
    if (!payoutsReady) out.push({ key: 'payouts', title: acct ? 'Finish Stripe setup' : 'Set up payouts', body: 'So ticket sales can reach you', route: '/host/payouts' });
    if (needsFee && finalCents > 0 && !cardComplete) out.push({ key: 'card', title: 'Add a card for the listing fee', body: 'Enter your card details below' });
    return out;
  }, [draft.is_paid, adultConfirmed, isVerifiedHost, payoutsReady, acct, needsFee, finalCents, cardComplete]);

  const goTo = (i: number) => {
    setStep(i);
    scrollRef.current?.scrollTo({ y: 0, animated: !t.reduceMotion });
  };

  const next = () => {
    const errs = errorsForStep(allErrors, step);
    setAttempted(prev => new Set(prev).add(step));
    if (Object.keys(errs).length > 0) {
      haptic.warning();
      return;
    }
    goTo(step + 1);
  };

  const onAdultChange = async (v: boolean) => {
    setAdultConfirmed(v);
    if (!v) return;
    try {
      setSettings(await confirmHostAdult());
    } catch (err) {
      if (!isNotSetUp(err)) showToast(errorMessage(err), 'error');
    }
  };

  const applyPromo = async () => {
    if (!token || !promo.trim()) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await validateListingPromo(promo.trim(), token);
      setFinalCents(Math.max(0, res.final_cents));
      setAppliedPromo(promo.trim());
      haptic.success();
    } catch (err) {
      setFinalCents(LISTING_FEE_CENTS);
      setAppliedPromo(null);
      setPromoError(errorMessage(err, 'That code isn’t valid'));
    } finally {
      setPromoBusy(false);
    }
  };

  const ensureValid = (): boolean => {
    const errs = validateDraft(draft, { editing });
    const bad = firstErrorStep(errs);
    if (bad === null) return true;
    setAttempted(new Set([0, 1, 2]));
    haptic.warning();
    goTo(bad);
    showToast(`Check the ${STEPS[bad]} step`, 'error');
    return false;
  };

  const persist = async (): Promise<string> => {
    if (!token) throw new Error('Please sign in again.');
    const payload = draftToPayload(draft);
    let id = existing?.id ?? createdId.current;
    if (id) {
      await updateEvent(id, payload, token);
    } else {
      const ev = await createEvent(payload, token);
      id = ev.id;
      createdId.current = id;
    }
    if (!existing && draft.is_paid) {
      for (const [sort_order, tk] of draft.tickets.entries()) {
        const qty = parseInt(tk.quantity, 10);
        const tier = { name: tk.name.trim(), price_cents: ticketCents(tk) ?? 0, quantity: Number.isFinite(qty) && qty > 0 ? qty : undefined };
        const sent = JSON.stringify(tier);
        const created = createdTiers.current.get(tk.key);
        if (!created) {
          const tt = await createTicketType({ event_id: id, ...tier }, token);
          createdTiers.current.set(tk.key, { id: tt.id, sent });
        } else if (created.sent !== sent) {
          await updateTicketType(created.id, { ...tier, quantity: tier.quantity ?? null, sort_order }, token);
          createdTiers.current.set(tk.key, { id: created.id, sent });
        }
      }
    }
    return id;
  };

  const saveDraft = async () => {
    if (!ensureValid()) return;
    setBusy(editing ? 'save' : 'draft');
    try {
      await persist();
      haptic.success();
      showToast(editing ? 'Changes saved' : 'Draft saved', 'success');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/host');
    } catch (err) {
      Alert.alert(editing ? 'Couldn’t save changes' : 'Couldn’t save draft', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!ensureValid() || !token || !user) return;
    if (blockers.length > 0) {
      haptic.warning();
      if (step !== 3) goTo(3);
      showToast(blockers[0].title, 'error');
      return;
    }
    setBusy('publish');
    try {
      const id = await persist();
      if (needsFee) {
        let paymentMethodId: string | undefined;
        if (finalCents > 0) {
          const { paymentMethod, error } = await createPaymentMethod({
            paymentMethodType: 'Card',
            paymentMethodData: { billingDetails: { email: user.email ?? undefined } },
          });
          if (error || !paymentMethod) throw new Error(error?.message ?? 'Your card could not be processed.');
          paymentMethodId = paymentMethod.id;
        }
        const res = await chargeListingFee({ paymentMethodId, eventId: id, hostEmail: user.email ?? undefined, promoCode: appliedPromo ?? undefined }, token);
        if (!res.success) throw new Error(res.error ?? 'The listing fee payment didn’t go through.');
        feePaid.current = true;
      }
      if (draft.schedule && draft.publish_at) await scheduleEvent(id, draft.publish_at.toISOString(), token);
      else await publishEvent(id, token);
      haptic.success();
      setBurst(n => n + 1);
      showToast(draft.schedule ? 'Event scheduled' : 'Your event is live', 'success');
      setTimeout(() => router.replace(`/event/${id}`), t.reduceMotion ? 300 : 900);
    } catch (err) {
      haptic.error();
      const saved = createdId.current || existing ? '\n\nYour event is saved as a draft — you can try again.' : '';
      Alert.alert('Couldn’t publish', `${errorMessage(err)}${saved}`);
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <Screen title="Create event" back>
        <EmptyState art="calendar" title="Host faith events" body="Sign in to create and manage events." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Edit event" back>
        <SkeletonGroup>
          <View style={{ padding: t.space.md, gap: t.space.md }}>
            <Skeleton height={6} />
            <Skeleton height={170} radius={t.radius.lg} />
            <Skeleton height={50} radius={t.radius.md} />
            <Skeleton height={104} radius={t.radius.md} />
          </View>
        </SkeletonGroup>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen title="Edit event" back>
        <EmptyState art="calendar" title="Couldn’t open this event" body={loadError} actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const canPublish = !editing || existing?.status === 'draft';
  const previewWidth = 248;

  return (
    <Screen
      title={editing ? 'Edit event' : 'Create event'}
      back
      right={
        step < 3 ? (
          <Pressable
            onPress={() => setShowPreview(v => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showPreview }}
            accessibilityLabel="Live preview"
            style={[s.previewToggle, showPreview && { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline }]}
          >
            <Ionicons name={showPreview ? 'eye' : 'eye-outline'} size={16} color={showPreview ? t.c.goldText : t.c.textMuted} />
            <AppText variant="caption" tone={showPreview ? 'gold' : 'muted'}>
              Preview
            </AppText>
          </Pressable>
        ) : undefined
      }
    >
      <View style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.sm }}>
        <StepProgress steps={STEPS} current={step} onStepPress={goTo} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {showPreview && step < 3 ? (
            <View style={s.previewWrap} accessibilityLabel="Live preview of your event card">
              <AppText variant="overline" tone="gold" style={{ marginBottom: t.space.sm }}>
                Live preview
              </AppText>
              <View pointerEvents="none">
                <EventCard event={preview} variant="carousel" width={previewWidth} onPress={() => undefined} />
              </View>
            </View>
          ) : null}

          <AppText variant="title2" style={{ marginBottom: t.space.md }}>
            {STEPS[step]}
          </AppText>

          {step === 0 && token ? <CreateBasics draft={draft} update={update} errors={visibleErrors} editing={editing} token={token} /> : null}
          {step === 1 ? <CreateWhenWhere draft={draft} update={update} errors={visibleErrors} editing={editing} /> : null}
          {step === 2 ? (
            <CreateTickets
              draft={draft}
              update={update}
              errors={visibleErrors}
              editing={editing}
              existingTickets={existing?.ticket_types ?? []}
              adultConfirmed={adultConfirmed}
              onAdultChange={onAdultChange}
              identityOk={isVerifiedHost}
              payoutsReady={payoutsReady}
              hasStripeAccount={!!acct?.stripe_account_id}
            />
          ) : null}
          {step === 3 ? (
            <CreateReview
              draft={draft}
              preview={preview}
              needsFee={needsFee && canPublish}
              promo={promo}
              onPromoChange={v => {
                setPromo(v);
                setPromoError(null);
              }}
              onApplyPromo={applyPromo}
              promoBusy={promoBusy}
              promoError={promoError}
              finalCents={finalCents}
              onCardComplete={setCardComplete}
              blockers={canPublish ? blockers : []}
              onBlockerPress={route => router.push(route)}
            />
          ) : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, t.space.sm) }]}>
          {step < 3 ? (
            <>
              {step > 0 ? <Button title="Back" variant="secondary" onPress={() => goTo(step - 1)} /> : null}
              <Button title={`Next: ${STEPS[step + 1]}`} iconRight="arrow-forward" onPress={next} style={{ flex: 1 }} fullWidth />
            </>
          ) : (
            <>
              <Button
                title={editing ? 'Save changes' : 'Save draft'}
                variant={canPublish ? 'secondary' : 'primary'}
                onPress={saveDraft}
                loading={busy === 'draft' || busy === 'save'}
                disabled={busy !== null}
                style={canPublish ? undefined : { flex: 1 }}
                fullWidth={!canPublish}
              />
              {canPublish ? (
                <Button
                  title={draft.schedule ? 'Schedule' : needsFee && finalCents > 0 ? 'Pay & publish' : 'Publish'}
                  icon="sparkles"
                  onPress={publish}
                  loading={busy === 'publish'}
                  disabled={busy !== null}
                  style={{ flex: 1 }}
                  fullWidth
                />
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <LightBurst play={burst} size={260} />
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  content: { paddingHorizontal: t.space.md, paddingTop: t.space.sm, paddingBottom: t.space.xxl },
  previewWrap: {
    alignItems: 'center',
    paddingVertical: t.space.md,
    marginBottom: t.space.lg,
    borderRadius: t.radius.lg,
    backgroundColor: t.c.surface2,
    borderWidth: 1,
    borderColor: t.c.border,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface,
  },
  footer: {
    flexDirection: 'row',
    gap: t.space.sm,
    paddingHorizontal: t.space.md,
    paddingTop: t.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.c.border,
    backgroundColor: t.c.bgElevated,
  },
}));
