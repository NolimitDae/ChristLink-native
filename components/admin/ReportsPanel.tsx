import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminDeletePost } from '../../lib/api';
import { getReportQueue, resolveReport } from '../../lib/features';
import { timeAgo } from '../../lib/format';
import type { ReportQueueItem } from '../../lib/types';
import { AppText, Badge, Button, Card } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { useLoad } from './useLoad';

const DAY = 86_400_000;
const REASONS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate: 'Hate',
  sexual: 'Sexual content',
  violence: 'Violence',
  scam: 'Scam',
  false_info: 'False information',
  other: 'Other',
};

export function ageLabel(iso: string): string {
  const age = timeAgo(iso);
  return /^\d+[mhd]$/.test(age) ? `${age} ago` : age;
}

export function ReportsPanel() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const fn = useCallback(() => getReportQueue(), []);
  const state = useLoad(fn);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (r: ReportQueueItem, action: 'remove' | 'dismiss') => {
    setBusy(r.id);
    try {
      if (action === 'remove' && r.target_type === 'post' && session?.access_token) await adminDeletePost(r.target_id, session.access_token);
      await resolveReport(r.id, action);
      showToast(action === 'remove' ? 'Content removed' : 'Report dismissed', 'success');
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = (r: ReportQueueItem) =>
    Alert.alert('Remove this content?', 'It will be hidden for everyone and the author may be notified.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => act(r, 'remove') },
    ]);

  const items = state.data ?? [];
  const overdue = items.filter(r => Date.now() - new Date(r.created_at).getTime() > DAY).length;

  return (
    <ScrollView
      contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
    >
      <View style={s.note}>
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          24-hour response target. Oldest reports first.
        </AppText>
        {overdue > 0 ? <Badge label={`${overdue} overdue`} tone="danger" /> : null}
      </View>
      <PanelState state={state} art="bell" emptyTitle="Queue is clear" emptyBody="No open reports. Thank you for keeping the community safe." isEmpty={d => d.length === 0} />
      {items.map(r => {
        const late = Date.now() - new Date(r.created_at).getTime() > DAY;
        return (
          <Card key={r.id} style={[{ gap: t.space.xs }, late ? { borderColor: t.c.danger, backgroundColor: t.c.dangerDim } : null]}>
            <View style={s.row}>
              <Badge label={r.target_type.replace('_', ' ')} tone="gold" />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {REASONS[r.reason] ?? r.reason}
              </AppText>
              {r.report_count > 1 ? <Badge label={`×${r.report_count}`} tone="danger" /> : null}
            </View>
            <AppText variant="callout" numberOfLines={4} style={s.preview}>
              {r.preview || '(no preview)'}
            </AppText>
            {r.details ? (
              <AppText variant="caption" tone="muted">
                “{r.details}”
              </AppText>
            ) : null}
            <AppText variant="caption" tone={late ? 'danger' : 'faint'}>
              {r.reporter_name ?? 'Anonymous'} · {ageLabel(r.created_at)}{late ? ' · over 24h' : ''}
            </AppText>
            <View style={s.row}>
              <Button title="Remove" variant="danger" size="sm" onPress={() => confirmRemove(r)} disabled={busy !== null} loading={busy === r.id} />
              <Button title="Dismiss" variant="secondary" size="sm" onPress={() => act(r, 'dismiss')} disabled={busy !== null} />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(t => ({
  note: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  preview: { padding: t.space.sm, borderRadius: t.radius.sm, backgroundColor: t.c.surface2, overflow: 'hidden' },
}));
