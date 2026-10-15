import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { decideChurchClaim, listPendingClaims, type ChurchClaim } from '../../lib/features';
import { AppText, Button, Card } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { ageLabel } from './ReportsPanel';
import { useLoad } from './useLoad';

export function ChurchClaimsPanel() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const fn = useCallback(() => listPendingClaims(), []);
  const state = useLoad(fn);
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (c: ChurchClaim, approve: boolean) => {
    setBusy(c.id);
    try {
      await decideChurchClaim(c.id, approve);
      showToast(approve ? 'Claim approved' : 'Claim rejected', approve ? 'success' : 'info');
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
    >
      <PanelState state={state} art="church" emptyTitle="No pending church claims" emptyBody="Requests from pastors and staff to manage a church page appear here." isEmpty={d => d.length === 0} />
      {(state.data ?? []).map(c => (
        <Card key={c.id} style={{ gap: t.space.xs }}>
          <AppText variant="headline">{c.churches?.name ?? 'Unknown church'}</AppText>
          <AppText variant="caption" tone="muted">
            {c.role_at_church ? `${c.role_at_church} · ` : ''}Requested {ageLabel(c.created_at)}
          </AppText>
          {c.note ? (
            <AppText variant="callout" tone="muted">
              “{c.note}”
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: 4 }}>
            <Button title="Approve" size="sm" onPress={() => decide(c, true)} disabled={busy !== null} loading={busy === c.id} />
            <Button title="Reject" variant="danger" size="sm" onPress={() => decide(c, false)} disabled={busy !== null} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
