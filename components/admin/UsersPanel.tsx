import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminDisconnectStripe, adminSetRole, adminUsers, type AdminRole, type AdminUser } from '../../lib/api';
import { formatDateShort } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { Avatar } from '../Avatar';
import { AppText, Badge, BottomSheet, Button, Card, ChipRow, Field, ListGroup, ListRow, Segmented } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { confirmAction } from './confirm';
import { useLoad } from './useLoad';

const FILTERS = ['all', 'admin', 'host', 'attendee'] as const;
type Filter = (typeof FILTERS)[number];
const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'attendee', label: 'Member' },
  { value: 'host', label: 'Host' },
  { value: 'admin', label: 'Admin' },
];

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function UsersPanel() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token ?? '';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDebounced(query.trim());
  const fn = useCallback(() => adminUsers(token, { q, role: filter === 'all' ? undefined : filter }).then(r => r.users), [token, q, filter]);
  const state = useLoad(fn);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const setRole = async (role: AdminRole) => {
    if (!selected || role === selected.role) return;
    if (role === 'admin' && !(await confirmAction('Make this person an admin?', `${selected.full_name || selected.email} will see every admin tool, including payouts and reports.`, 'Make admin'))) return;
    setBusy(true);
    try {
      await adminSetRole(selected.id, role, token);
      haptic.success();
      showToast('Role updated', 'success');
      setSelected({ ...selected, role });
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!selected) return;
    if (!(await confirmAction('Disconnect payouts?', 'They’ll need to set up payouts again before selling tickets. Their Stripe account isn’t deleted.', 'Disconnect'))) return;
    setBusy(true);
    try {
      await adminDisconnectStripe(selected.id, token);
      showToast('Payout account disconnected', 'success');
      setSelected({ ...selected, stripe_account_id: null });
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const isSelf = selected?.id === user?.id;

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
        keyboardShouldPersistTaps="handled"
      >
        <Field placeholder="Search name or email" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search users" />
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} labels={{ all: 'Everyone', admin: 'Admins', host: 'Hosts', attendee: 'Members' }} />
        <PanelState state={state} art="people" emptyTitle="No one found" emptyBody="Try another name or email." isEmpty={d => d.length === 0} />
        {(state.data ?? []).map(u => (
          <Card key={u.id} onPress={() => setSelected(u)} accessibilityLabel={`Manage ${u.full_name || u.email}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Avatar uri={u.avatar_url} name={u.full_name ?? u.email ?? '?'} color={u.avatar_color} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {u.full_name || 'No name'}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {[u.email, u.created_at ? `joined ${formatDateShort(u.created_at)}` : null].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            {u.role === 'admin' ? <Badge label="Admin" tone="gold" /> : u.role === 'host' ? <Badge label="Host" tone="success" /> : null}
          </Card>
        ))}
      </ScrollView>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.full_name || selected?.email || 'Member'} subtitle={selected?.email ?? undefined}>
        {selected ? (
          <View style={{ gap: t.space.md }}>
            <View style={{ gap: t.space.xs }}>
              <AppText variant="label" tone="muted">
                Role
              </AppText>
              {isSelf ? (
                <AppText variant="callout" tone="muted">
                  You can’t change your own role.
                </AppText>
              ) : (
                <Segmented options={ROLE_OPTIONS} value={(selected.role as AdminRole) || 'attendee'} onChange={setRole} />
              )}
            </View>
            <ListGroup>
              <ListRow icon="person-outline" title="View profile" onPress={() => { setSelected(null); router.push(`/user/${selected.id}`); }} last={!selected.stripe_account_id} />
              {selected.stripe_account_id ? <ListRow icon="wallet-outline" title="Disconnect payout account" subtitle={selected.stripe_account_id} onPress={disconnect} destructive last /> : null}
            </ListGroup>
            <Button title="Done" variant="secondary" onPress={() => setSelected(null)} loading={busy} fullWidth />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}
