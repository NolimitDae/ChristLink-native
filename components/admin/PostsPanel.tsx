import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adminDeletePost, adminPosts } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { AppText, Button, Card } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { confirmAction } from './confirm';
import { useLoad } from './useLoad';

/** Latest community posts, newest first, with Remove. Reported content is handled in Reports. */
export function PostsPanel() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token ?? '';
  const fn = useCallback(() => adminPosts(token).then(r => r.posts), [token]);
  const state = useLoad(fn);
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!(await confirmAction('Remove this post?', 'It’s deleted for everyone, with its replies.', 'Remove'))) return;
    setBusy(id);
    try {
      await adminDeletePost(id, token);
      showToast('Post removed', 'success');
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
      <PanelState state={state} art="cross" emptyTitle="No posts yet" isEmpty={d => d.length === 0} />
      {(state.data ?? []).map(p => (
        <Card key={p.id} style={{ gap: t.space.xs }}>
          <AppText variant="caption" tone="muted">
            {[p.profiles?.full_name || 'Member', p.created_at ? timeAgo(p.created_at) : null].filter(Boolean).join(' · ')}
          </AppText>
          <AppText variant="callout" numberOfLines={6}>
            {p.body ?? p.content ?? ''}
          </AppText>
          <View style={{ alignItems: 'flex-start' }}>
            <Button title="Remove" variant="ghost" size="sm" onPress={() => remove(p.id)} loading={busy === p.id} disabled={busy !== null} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
