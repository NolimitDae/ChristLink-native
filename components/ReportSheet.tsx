import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { blockUser, reportContent } from '../lib/features';
import type { ReportReason, ReportTarget } from '../lib/types';
import { AppText } from './ui/AppText';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Field } from './ui/Field';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'false_info', label: 'False information' },
  { value: 'other', label: 'Something else' },
];

interface Target {
  type: ReportTarget;
  id: string;
  authorId?: string | null;
  authorName?: string | null;
}

/** Report + block flow shared by posts, replies, forum messages, prayers, profiles, events and churches. */
export function useReport() {
  const { session } = useAuth();
  const { refreshBlocked } = useAppData();
  const { showToast } = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const open = useCallback(
    (t: Target) => {
      if (!session) {
        showToast('Sign in to report content', 'info');
        return;
      }
      setTarget(t);
      setReason(null);
      setDetails('');
    },
    [session, showToast],
  );

  const close = () => setTarget(null);

  const submit = async () => {
    if (!target || !reason) return;
    setBusy(true);
    try {
      await reportContent(target.type, target.id, reason, details);
      showToast('Thanks. Our team reviews reports within 24 hours.', 'success');
      close();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send report', 'error');
    } finally {
      setBusy(false);
    }
  };

  const block = () => {
    if (!target?.authorId) return;
    Alert.alert(
      `Block ${target.authorName ?? 'this person'}?`,
      'You won’t see their posts, prayers or messages, and they won’t be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(target.authorId!);
              await refreshBlocked();
              showToast('Blocked', 'success');
              close();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Could not block', 'error');
            }
          },
        },
      ],
    );
  };

  const sheet = (
    <BottomSheet
      visible={!!target}
      onClose={close}
      title="Report"
      subtitle="Reports are anonymous to the person you report."
      footer={
        <View style={{ gap: 10 }}>
          <Button title="Send report" onPress={submit} disabled={!reason} loading={busy} fullWidth />
          {target?.authorId && target.authorId !== session?.user.id ? (
            <Button title={`Block ${target.authorName ?? 'user'}`} variant="danger" onPress={block} fullWidth />
          ) : null}
        </View>
      }
    >
      <AppText variant="callout" tone="muted" style={{ marginBottom: 12 }}>
        Why are you reporting this?
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {REASONS.map(r => (
          <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
      <Field label="Anything else? (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder="Add context for our moderators" />
    </BottomSheet>
  );

  return { open, sheet };
}
