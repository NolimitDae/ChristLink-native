import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { amenPost, deleteCommunityPost, getCommunityPosts } from '../../lib/api';
import type { CommunityPost, CommunityReply } from '../../lib/types';
import { useReport } from '../ReportSheet';
import { useShareCard } from '../ShareCard';
import { EmptyState, PostSkeleton, SkeletonGroup } from '../ui';
import { ActionMenu, type MenuAction } from './ActionMenu';
import { Composer } from './Composer';
import { PostCard } from './PostCard';

export function FeedView({ bottomPad }: { bottomPad: number }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { blockedIds, hiddenPostIds, hidePost } = useAppData();
  const { showToast } = useToast();
  const report = useReport();
  const { open: openReport } = report;
  const { open: openShare, sheet: shareSheet } = useShareCard();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const token = session?.access_token;
  const myId = session?.user.id;

  const load = useCallback(async () => {
    try {
      const res = await getCommunityPosts(token);
      setPosts(res.posts);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const patch = useCallback((id: string, fn: (p: CommunityPost) => CommunityPost) => {
    setPosts(prev => (prev ? prev.map(p => (p.id === id ? fn(p) : p)) : prev));
  }, []);

  const onAmen = useCallback(
    async (post: CommunityPost, fromDoubleTap: boolean) => {
      if (!token) {
        router.push('/auth');
        return;
      }
      if (fromDoubleTap && post.has_amened) return;
      const wasAmened = !!post.has_amened;
      const before = { has_amened: post.has_amened, amen_count: post.amen_count };
      patch(post.id, p => ({ ...p, has_amened: !wasAmened, amen_count: Math.max(0, p.amen_count + (wasAmened ? -1 : 1)) }));
      try {
        const res = await amenPost(post.id, token);
        patch(post.id, p => ({ ...p, has_amened: res.amened, amen_count: res.amen_count }));
      } catch {
        patch(post.id, p => ({ ...p, ...before }));
        showToast('Could not say Amen. Please try again.', 'error');
      }
    },
    [token, router, patch, showToast],
  );

  const onShare = useCallback(
    (post: CommunityPost) => openShare({ kind: 'testimony', text: post.content, author: post.profiles?.full_name }),
    [openShare],
  );

  const onRepliesChange = useCallback((id: string, count: number) => patch(id, p => ({ ...p, reply_count: count })), [patch]);

  const onReportReply = useCallback(
    (reply: CommunityReply) => {
      if (reply.user_id === myId) return;
      openReport({ type: 'reply', id: reply.id, authorId: reply.user_id, authorName: reply.profiles?.full_name });
    },
    [openReport, myId],
  );

  const confirmDelete = (post: CommunityPost) => {
    if (!token) return;
    Alert.alert('Delete this post?', 'It will be removed for everyone, including its replies.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCommunityPost(post.id, token);
            setPosts(prev => prev?.filter(p => p.id !== post.id) ?? prev);
            showToast('Post deleted', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not delete post', 'error');
          }
        },
      },
    ]);
  };

  const menuActions = (post: CommunityPost): MenuAction[] => {
    if (post.user_id === myId) return [{ label: 'Delete post', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(post) }];
    return [
      {
        label: 'Report post',
        icon: 'flag-outline',
        onPress: () => report.open({ type: 'post', id: post.id, authorId: post.user_id, authorName: post.profiles?.full_name }),
      },
      {
        label: 'Hide post',
        icon: 'eye-off-outline',
        onPress: () => {
          hidePost(post.id);
          showToast('Post hidden', 'info');
        },
      },
    ];
  };

  const visible = useMemo(
    () => (posts ?? []).filter(p => !blockedIds.has(p.user_id) && !hiddenPostIds.has(p.id)),
    [posts, blockedIds, hiddenPostIds],
  );

  const header = (
    <View style={{ paddingTop: t.space.xs, paddingBottom: t.space.md }}>
      <Composer onPosted={post => setPosts(prev => [post, ...(prev ?? [])])} />
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (posts === null && !failed) {
    empty = (
      <SkeletonGroup label="Loading posts">
        <View style={{ gap: t.space.sm, paddingHorizontal: t.space.md }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      </SkeletonGroup>
    );
  } else if (failed && posts === null) {
    empty = <EmptyState art="offline" title="Couldn't load the feed" body="Check your connection and try again." actionLabel="Try again" onAction={load} />;
  } else {
    empty = (
      <EmptyState
        art="people"
        title="Be the first to share"
        body="Prayer requests, praise reports and testimonies from the community will appear here."
        actionLabel={session ? undefined : 'Sign in'}
        onAction={session ? undefined : () => router.push('/auth')}
      />
    );
  }

  return (
    <>
      <FlatList
        data={visible}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onAmen={onAmen}
            onMenu={setMenuPost}
            onShare={onShare}
            onRepliesChange={onRepliesChange}
            onReportReply={onReportReply}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: t.space.sm }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
        removeClippedSubviews={false}
      />
      <ActionMenu visible={!!menuPost} onClose={() => setMenuPost(null)} title="Post" actions={menuPost ? menuActions(menuPost) : []} />
      {report.sheet}
      {shareSheet}
    </>
  );
}
