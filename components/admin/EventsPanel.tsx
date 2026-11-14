import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminCancelEvent, adminDeleteEvent, adminEvents, type AdminEvent } from '../../lib/api';
import { formatDateShort } from '../../lib/format';
import { AppText, Badge, BottomSheet, Card, ChipRow, Field, ListGroup, ListRow } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { confirmAction } from './confirm';
import { useLoad } from './useLoad';

const FILTERS = ['all', 'published', 'draft', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

function statusBadge(status: string | null) {
  if (status === 'published') return <Badge label="Live" tone="success" />;
  if (status === 'cancelled') return <Badge label="Cancelled" tone="danger" />;
  return <Badge label={status === 'draft' ? 'Draft' : status || 'Draft'} tone="neutral" />;
}

export function EventsPanel() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token ?? '';
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);
  const fn = useCallback(() => adminEvents(token, { q, status: filter === 'all' ? undefined : filter }).then(r => r.events), [token, q, filter]);
  const state = useLoad(fn);
  const [selected, setSelected] = useState<AdminEvent | null>(null);

  const run = async (action: 'cancel' | 'delete') => {
    if (!selected) return;
    const ok =
      action === 'cancel'
        ? await confirmAction('Cancel this event?', 'It stays visible as cancelled. Refund paid tickets from the event’s Sales screen.', 'Cancel event')
        : await confirmAction('Delete this event?', 'The event and its RSVPs are removed for good. Use Cancel instead if anyone bought tickets.', 'Delete');
    if (!ok) return;
    try {
      if (action === 'cancel') await adminCancelEvent(selected.id, token);
      else await adminDeleteEvent(selected.id, token);
      showToast(action === 'cancel' ? 'Event cancelled' : 'Event deleted', 'success');
      setSelected(null);
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
        keyboardShouldPersistTaps="handled"
      >
        <Field placeholder="Search event, city or host" value={query} onChangeText={setQuery} accessibilityLabel="Search events" />
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} labels={{ all: 'All', published: 'Live', draft: 'Drafts', cancelled: 'Cancelled' }} />
        <PanelState state={state} art="calendar" emptyTitle="No events found" isEmpty={d => d.length === 0} />
        {(state.data ?? []).map(e => (
          <Card key={e.id} onPress={() => setSelected(e)} accessibilityLabel={`Manage ${e.name}`} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {e.name}
              </AppText>
              {statusBadge(e.status)}
            </View>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {[e.start_date ? formatDateShort(e.start_date) : 'No date', [e.city, e.state].filter(Boolean).join(', '), e.host?.full_name || e.host?.email].filter(Boolean).join(' · ')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {e.is_paid ? `${e.tickets_sold} ticket${e.tickets_sold === 1 ? '' : 's'} sold` : `${e.rsvps} going`}
            </AppText>
          </Card>
        ))}
      </ScrollView>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? 'Event'} subtitle={selected?.host?.full_name ?? undefined}>
        {selected ? (
          <ListGroup>
            <ListRow icon="open-outline" title="Open event" onPress={() => { setSelected(null); router.push(`/event/${selected.id}`); }} />
            {selected.is_paid ? <ListRow icon="cash-outline" title="Sales and refunds" onPress={() => { setSelected(null); router.push(`/event/${selected.id}/sales`); }} /> : null}
            {selected.host ? <ListRow icon="person-outline" title="Host profile" onPress={() => { setSelected(null); router.push(`/user/${selected.host!.id}`); }} /> : null}
            {selected.status !== 'cancelled' ? <ListRow icon="close-circle-outline" title="Cancel event" onPress={() => run('cancel')} destructive /> : null}
            <ListRow icon="trash-outline" title="Delete event" onPress={() => run('delete')} destructive last />
          </ListGroup>
        ) : null}
      </BottomSheet>
    </>
  );
}
