import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { createCommunityReply, getCommunityReplies } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { CommunityReply } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, Button, Field, IconButton, Skeleton } from '../ui';

interface RepliesThreadProps {
  postId: string;
  onCountChange: (count: number) => void;
  onReportReply: (reply: CommunityReply) => void;
}

export function RepliesThread({ postId, onCountChange, onReportReply }: RepliesThreadProps) {
  const t = useTheme();
  const router = useRouter();
  const { session, profile } = useAuth();
  const { blockedIds } = useAppData();
  const { showToast } = useToast();
  const [replies, setReplies] = useState<CommunityReply[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const token = session?.access_token;

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await getCommunityReplies(postId, token);
      setReplies(res.replies);
    } catch {
      setFailed(true);
    }
  }, [postId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token || !session) return;
    setSending(true);
    try {
      const reply = await createCommunityReply(postId, text, token);
      const withAuthor: CommunityReply = {
        ...reply,
        user_id: reply.user_id || session.user.id,
        created_at: reply.created_at ?? new Date().toISOString(),
        profiles: reply.profiles ?? {
          id: session.user.id,
          full_name: profile?.full_name ?? 'You',
          avatar_url: profile?.avatar_url,
          avatar_color: profile?.avatar_color,
        },
      };
      const next = [...(replies ?? []), withAuthor];
      setReplies(next);
      onCountChange(next.length);
      setDraft('');
      haptic.light();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send reply', 'error');
    } finally {
      setSending(false);
    }
  };

  const visible = (replies ?? []).filter(r => !blockedIds.has(r.user_id));

  return (
    <View style={{ marginTop: t.space.sm, paddingTop: t.space.sm, borderTopWidth: 1, borderTopColor: t.c.border, gap: t.space.sm }}>
      {replies === null && !failed ? (
        <View style={{ gap: 8 }} accessibilityLabel="Loading replies">
          <Skeleton width="70%" height={12} />
          <Skeleton width="50%" height={12} />
        </View>
      ) : null}
      {failed ? (
        <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Retry loading replies" style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="caption" tone="danger">
            Couldn&apos;t load replies. Tap to retry.
          </AppText>
        </Pressable>
      ) : null}
      {replies !== null && visible.length === 0 ? (
        <AppText variant="caption" tone="faint">
          No replies yet. Be the first to encourage them.
        </AppText>
      ) : null}
      {visible.map(r => (
        <Pressable
          key={r.id}
          onLongPress={() => {
            haptic.medium();
            onReportReply(r);
          }}
          delayLongPress={350}
          accessibilityLabel={`Reply from ${r.profiles?.full_name ?? 'someone'}: ${r.content}`}
          accessibilityHint="Long press to report"
          style={{ flexDirection: 'row', gap: t.space.xs }}
        >
          <Avatar uri={r.profiles?.avatar_url} name={r.profiles?.full_name} color={r.profiles?.avatar_color} size={28} />
          <View style={{ flex: 1, backgroundColor: t.c.surface2, borderRadius: t.radius.md, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="caption" style={{ flexShrink: 1 }} numberOfLines={1}>
                {r.profiles?.full_name ?? 'Member'}
              </AppText>
              <AppText variant="caption" tone="faint">
                {timeAgo(r.created_at)}
              </AppText>
            </View>
            <AppText variant="callout" style={{ marginTop: 2 }}>
              {r.content}
            </AppText>
          </View>
        </Pressable>
      ))}
      {session ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.xs }}>
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a reply…"
            maxLength={500}
            containerStyle={{ flex: 1 }}
            accessibilityLabel="Reply text"
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <IconButton icon="send" label="Send reply" tone="gold" size={44} onPress={send} disabled={sending || !draft.trim()} style={{ marginBottom: 3 }} />
        </View>
      ) : (
        <Button title="Sign in to reply" variant="ghost" size="sm" onPress={() => router.push('/auth')} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}
