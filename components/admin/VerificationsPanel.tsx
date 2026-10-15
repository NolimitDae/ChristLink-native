import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminDecideVerification, adminListVerifications, adminVerificationDocUrl } from '../../lib/api';
import { formatDateShort } from '../../lib/format';
import { AppText, Badge, BottomSheet, Button, Card, Field } from '../ui';
import { errorMessage, readRecord, readString } from '../host/errors';
import { PanelState } from './PanelState';
import { ageLabel } from './ReportsPanel';
import { useLoad } from './useLoad';

interface VerificationRow {
  id: string;
  legalName: string;
  userId?: string;
  userName?: string;
  submittedAt?: string;
  status: string;
}

function toRow(raw: unknown): VerificationRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = readString(r, 'id');
  if (!id && typeof r.id !== 'number') return null;
  const profile = readRecord(r, 'profiles');
  return {
    id: id ?? String(r.id),
    legalName: readString(r, 'legal_name', 'legalName') ?? 'Unnamed',
    userId: readString(r, 'user_id', 'userId'),
    userName: profile ? readString(profile, 'full_name') : readString(r, 'full_name'),
    submittedAt: readString(r, 'submitted_at', 'created_at'),
    status: readString(r, 'status') ?? 'pending',
  };
}

export function VerificationsPanel() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token ?? '';
  const fn = useCallback(async () => {
    const res = await adminListVerifications(token);
    return (res.verifications ?? []).map(toRow).filter((x): x is VerificationRow => x !== null);
  }, [token]);
  const state = useLoad(fn);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VerificationRow | null>(null);
  const [reason, setReason] = useState('');

  const viewId = async (v: VerificationRow) => {
    setBusy(v.id);
    try {
      const { url } = await adminVerificationDocUrl(v.id, token);
      if (!url) throw new Error('No document on file.');
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      showToast(errorMessage(err, 'Could not open ID'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const decide = async (v: VerificationRow, approve: boolean, why?: string) => {
    setBusy(v.id);
    try {
      await adminDecideVerification(v.id, approve, token, why);
      showToast(approve ? `${v.legalName} approved` : 'Verification rejected', approve ? 'success' : 'info');
      setRejecting(null);
      setReason('');
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const rows = state.data ?? [];
  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <PanelState state={state} art="people" emptyTitle="No pending verifications" emptyBody="New host ID submissions will appear here." isEmpty={d => d.length === 0} />
        {rows.map(v => (
          <Card key={v.id} style={{ gap: t.space.xs }}>
            <View style={s.row}>
              <AppText variant="headline" style={{ flex: 1 }}>
                {v.legalName}
              </AppText>
              <Badge label={v.status} tone={v.status === 'pending' ? 'gold' : v.status === 'approved' ? 'success' : 'danger'} />
            </View>
            <AppText variant="caption" tone="muted">
              {v.userName ? `${v.userName} · ` : ''}
              {v.submittedAt ? `Submitted ${formatDateShort(v.submittedAt)} (${ageLabel(v.submittedAt)})` : 'Submission date unknown'}
            </AppText>
            <View style={[s.row, { flexWrap: 'wrap', marginTop: 4 }]}>
              <Button title="View ID" icon="document-text-outline" variant="secondary" size="sm" onPress={() => viewId(v)} disabled={busy !== null} />
              <Button title="Approve" size="sm" onPress={() => decide(v, true)} disabled={busy !== null} loading={busy === v.id && !rejecting} />
              <Button title="Reject" variant="danger" size="sm" onPress={() => setRejecting(v)} disabled={busy !== null} />
            </View>
          </Card>
        ))}
      </ScrollView>
      <BottomSheet
        visible={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject verification"
        subtitle={rejecting?.legalName}
        footer={
          <Button
            title="Reject"
            variant="danger"
            fullWidth
            disabled={!reason.trim()}
            loading={!!rejecting && busy === rejecting.id}
            onPress={() => rejecting && decide(rejecting, false, reason.trim())}
          />
        }
      >
        <Field label="Reason (shown to the host)" value={reason} onChangeText={setReason} placeholder="Photo is blurry — please retake with all corners visible." multiline maxLength={300} />
      </BottomSheet>
    </>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
}));
