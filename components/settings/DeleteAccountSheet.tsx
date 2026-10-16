import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { FeatureError, deleteMyAccount } from '../../lib/features';
import { SUPPORT_EMAIL } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { AppText, BottomSheet, Button, Field } from '../ui';

export const DELETE_EXPLANATION =
  'This permanently deletes your profile, photos, posts, replies, prayers, follows and saved settings.\n\n' +
  'Ticket and payment records are kept because the law requires it, but they are anonymized and no longer linked to you.';

export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTyped('');
      setError(null);
    }
  }, [visible]);

  const confirmDelete = async () => {
    if (typed.trim() !== 'DELETE') return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      haptic.success();
      await signOut();
      onClose();
      router.replace('/(tabs)');
      showToast('Your account has been deleted', 'success');
    } catch (err) {
      haptic.error();
      if (err instanceof FeatureError && err.notSetUp) {
        setError(`In-app deletion isn't available yet. Email ${SUPPORT_EMAIL} and we'll delete your account within 7 days.`);
      } else {
        setError(err instanceof Error ? err.message : 'Could not delete your account. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Delete account"
      subtitle="This can't be undone."
      footer={
        <Button title="Delete my account" variant="danger" icon="trash-outline" onPress={confirmDelete} loading={busy} disabled={typed.trim() !== 'DELETE'} fullWidth />
      }
    >
      <View style={{ gap: t.space.md }}>
        <AppText variant="callout" tone="muted">
          {DELETE_EXPLANATION}
        </AppText>
        <Field
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          error={error}
        />
      </View>
    </BottomSheet>
  );
}
