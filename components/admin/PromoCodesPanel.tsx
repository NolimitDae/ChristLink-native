import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminCreatePromo, adminPromoCodes, adminSetPromoActive, type PromoCode } from '../../lib/api';
import { formatCents, LISTING_FEE_CENTS, parseDollarsToCents } from '../../lib/fees';
import { formatDateShort } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { AppText, BottomSheet, Button, Field, ListGroup, ListRow, Segmented } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { useLoad } from './useLoad';
import { promoLabel } from '../../lib/admin';

type Kind = 'percent' | 'fixed';
interface Draft {
  code: string;
  kind: Kind;
  value: string;
  maxUses: string;
  expires: string;
}
const blank: Draft = { code: '', kind: 'percent', value: '', maxUses: '', expires: '' };

/** Listing-fee promo codes: hosts enter them when paying the listing fee for a paid event. */
export function PromoCodesPanel() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token ?? '';
  const fn = useCallback(() => adminPromoCodes(token).then(r => r.codes), [token]);
  const state = useLoad(fn);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);

  const toggle = async (p: PromoCode, active: boolean) => {
    try {
      await adminSetPromoActive(p.id, active, token);
      haptic.tap();
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const create = async () => {
    if (!draft) return;
    const e: typeof errors = {};
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) e.code = 'Use 3–30 letters, numbers, - or _';
    let value = 0;
    if (draft.kind === 'percent') {
      value = Number(draft.value);
      if (!Number.isFinite(value) || value <= 0 || value > 100) e.value = 'Enter 1 to 100';
    } else {
      const cents = parseDollarsToCents(draft.value);
      if (!cents || cents <= 0) e.value = 'Enter an amount like 5 or 19.99';
      else value = cents / 100;
    }
    const maxUses = draft.maxUses.trim() ? Number(draft.maxUses) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) e.maxUses = 'Whole number, or leave blank';
    const expires = draft.expires.trim();
    if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || isNaN(new Date(`${expires}T23:59:59`).getTime()))) e.expires = 'Use YYYY-MM-DD, or leave blank';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await adminCreatePromo(
        { code, discount_type: draft.kind, discount_value: value, max_uses: maxUses, expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null },
        token,
      );
      haptic.success();
      showToast(`${code} created`, 'success');
      setDraft(null);
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const codes = state.data ?? [];
  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <AppText variant="callout" tone="muted">
          Hosts enter these when they pay the {formatCents(LISTING_FEE_CENTS)} listing fee for a paid event. Turn a code off to stop new uses.
        </AppText>
        <Button
          title="New promo code"
          icon="add"
          onPress={() => {
            setErrors({});
            setDraft({ ...blank });
          }}
          style={{ alignSelf: 'flex-start' }}
        />
        <PanelState state={state} art="ticket" emptyTitle="No promo codes yet" emptyBody="Create one to waive or discount the listing fee." isEmpty={d => d.length === 0} />
        {codes.length ? (
          <ListGroup>
            {codes.map((p, i) => {
              const expired = !!p.expires_at && new Date(p.expires_at).getTime() < Date.now();
              const usedUp = p.max_uses !== null && p.uses_count >= p.max_uses;
              const detail = [
                promoLabel(p),
                `${p.uses_count}${p.max_uses !== null ? ` of ${p.max_uses}` : ''} used`,
                p.expires_at ? `${expired ? 'expired' : 'until'} ${formatDateShort(p.expires_at)}` : null,
                usedUp ? 'used up' : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return <ListRow key={p.id} title={p.code} subtitle={detail} toggle={p.active} onToggle={v => toggle(p, v)} last={i === codes.length - 1} />;
            })}
          </ListGroup>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title="New promo code"
        footer={<Button title="Create code" onPress={create} loading={saving} fullWidth size="lg" />}
      >
        {draft ? (
          <View style={{ gap: t.space.md }}>
            <Field
              label="Code"
              placeholder="LAUNCH50"
              autoCapitalize="characters"
              autoCorrect={false}
              value={draft.code}
              onChangeText={code => setDraft({ ...draft, code })}
              error={errors.code}
            />
            <Segmented
              options={[
                { value: 'percent', label: 'Percent off' },
                { value: 'fixed', label: 'Dollars off' },
              ]}
              value={draft.kind}
              onChange={kind => setDraft({ ...draft, kind })}
            />
            <Field
              label={draft.kind === 'percent' ? 'Percent off' : 'Dollars off'}
              placeholder={draft.kind === 'percent' ? '100' : '10'}
              keyboardType="decimal-pad"
              value={draft.value}
              onChangeText={value => setDraft({ ...draft, value })}
              error={errors.value}
              hint={draft.kind === 'percent' ? '100% makes the listing free.' : `The listing fee is ${formatCents(LISTING_FEE_CENTS)}.`}
            />
            <Field label="Use limit (optional)" placeholder="No limit" keyboardType="number-pad" value={draft.maxUses} onChangeText={maxUses => setDraft({ ...draft, maxUses })} error={errors.maxUses} />
            <Field label="Last day (optional)" placeholder="YYYY-MM-DD" autoCorrect={false} value={draft.expires} onChangeText={expires => setDraft({ ...draft, expires })} error={errors.expires} />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}
