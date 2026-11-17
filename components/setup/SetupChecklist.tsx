import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useGettingStarted } from '../../contexts/GettingStartedContext';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { SETUP_GROUPS, SETUP_STEP_COPY, setupProgress, setupSummary } from '../../lib/gettingStarted';
import type { GettingStarted, SetupStepId } from '../../lib/types';
import { AppIcon } from '../icons/AppIcon';
import { uploadProfileImage } from '../profile/uploadProfileImage';
import { AppText, Card, ProgressBar } from '../ui';

/**
 * "Get set up" card at the top of Notifications: a progress bar and the setup steps, each opening the place where
 * it's done. Steps tick themselves (the server checks); finishing the last one brings up the celebration.
 */
export function SetupChecklist({ status, onEditProfile }: { status: GettingStarted; onEditProfile: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const { refresh, hide } = useGettingStarted();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState<SetupStepId | null>(null);
  const done = new Map(status.steps.map(x => [x.id, x.done]));

  const run = async (id: SetupStepId) => {
    const { action } = SETUP_STEP_COPY[id];
    if (action.kind === 'route') {
      router.push(action.to as never);
      return;
    }
    if (action.kind === 'profile') {
      onEditProfile();
      return;
    }
    const token = session?.access_token;
    if (!token) return;
    try {
      const kind = action.kind === 'cover' ? 'banner' : 'avatar';
      if (!(await uploadProfileImage(kind, token, () => setUploading(id)))) return;
      await refreshProfile();
      showToast(kind === 'banner' ? 'Cover photo added' : 'Profile photo added', 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  return (
    <Card style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title3">Get set up</AppText>
          <AppText variant="callout" tone="muted">
            {setupSummary(status)}
          </AppText>
        </View>
        <AppText variant="headline" tone="gold" accessibilityElementsHidden importantForAccessibility="no">
          {status.done}/{status.total}
        </AppText>
      </View>
      <ProgressBar
        value={setupProgress(status)}
        label="Setup progress"
        valueText={`${status.done} of ${status.total} steps done`}
        style={{ marginTop: t.space.sm }}
      />

      {SETUP_GROUPS.map(group => (
        <View key={group.title} style={{ marginTop: t.space.md }}>
          <AppText variant="label" tone="muted" style={{ marginBottom: t.space.xxs }}>
            {group.title}
          </AppText>
          {group.steps.map(id => {
            const copy = SETUP_STEP_COPY[id];
            const isDone = !!done.get(id);
            const busy = uploading === id;
            return (
              <Pressable
                key={id}
                onPress={isDone || busy ? undefined : () => run(id)}
                disabled={isDone || busy}
                accessibilityRole="button"
                accessibilityLabel={`${copy.title}. ${isDone ? 'Done' : copy.body}`}
                accessibilityState={{ checked: isDone, disabled: isDone, busy }}
                style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={s.check}>
                  {busy ? (
                    <ActivityIndicator size="small" color={t.c.goldText} />
                  ) : isDone ? (
                    <Ionicons name="checkmark-circle" size={24} color={t.c.gold} />
                  ) : (
                    <AppIcon name={copy.icon} size={22} color={t.c.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" tone={isDone ? 'muted' : 'default'} style={isDone ? s.doneText : undefined}>
                    {copy.title}
                  </AppText>
                  {isDone ? null : (
                    <AppText variant="callout" tone="muted">
                      {copy.body}
                    </AppText>
                  )}
                </View>
                {isDone ? null : <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable onPress={hide} accessibilityRole="button" accessibilityLabel="Hide this checklist" hitSlop={8} style={s.hide}>
        <AppText variant="callout" tone="muted">
          Hide checklist
        </AppText>
      </Pressable>
    </Card>
  );
}

const useStyles = makeStyles(t => ({
  card: { marginHorizontal: t.space.md, marginTop: t.space.sm, marginBottom: t.space.md, padding: t.space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: 56, paddingVertical: t.space.xs },
  check: { width: 28, alignItems: 'center' },
  doneText: { textDecorationLine: 'line-through' },
  hide: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: t.space.xs },
}));
