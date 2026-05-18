import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { GoldButton } from '../../components/GoldButton';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCommunityPosts, createCommunityPost, amenPost } from '../../lib/api';
import { COLORS } from '../../lib/constants';
import { logger } from '../../lib/logger';
import type { CommunityPost } from '../../lib/types';

const C = COLORS.dark;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PostItemProps {
  post: CommunityPost;
  onAmen: (postId: string) => void;
  currentUserId?: string;
}

function PostItem({ post, onAmen, currentUserId: _currentUserId }: PostItemProps) {
  const profile = post.profiles;
  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.full_name}
          color={profile?.avatar_color}
          size={40}
        />
        <View style={styles.postHeaderText}>
          <View style={styles.nameRow}>
            <Text style={styles.posterName}>{profile?.full_name ?? 'Anonymous'}</Text>
            {profile?.role === 'verified' || profile?.role === 'admin' ? (
              <Ionicons name="checkmark-circle" size={14} color={C.gold} />
            ) : null}
          </View>
          <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.amenBtn}
          onPress={() => onAmen(post.id)}
        >
          <Ionicons
            name={post.has_amened ? 'heart' : 'heart-outline'}
            size={20}
            color={post.has_amened ? C.gold : C.muted}
          />
          <Text style={[styles.amenCount, post.has_amened && styles.amenCountActive]}>
            {post.amen_count > 0 ? post.amen_count : ''} Amen
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await getCommunityPosts(session?.access_token);
      setPosts(res.posts);
    } catch (err) {
      logger.error('Failed to fetch posts', { error: String(err) });
    }
  }, [session]);

  useEffect(() => {
    setLoading(true);
    fetchPosts().finally(() => setLoading(false));
  }, [fetchPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handlePost = async () => {
    if (!session?.access_token) {
      router.push('/auth');
      return;
    }
    const content = newPost.trim();
    if (!content) return;
    if (content.length > 1000) {
      showToast('Post is too long (max 1000 characters)', 'error');
      return;
    }

    setPosting(true);
    try {
      const post = await createCommunityPost(content, session.access_token);
      setPosts(prev => [post, ...prev]);
      setNewPost('');
      showToast('Posted to community!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post';
      showToast(message, 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleAmen = async (postId: string) => {
    if (!session?.access_token) {
      router.push('/auth');
      return;
    }
    // Optimistic update
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const nowAmened = !p.has_amened;
        return {
          ...p,
          has_amened: nowAmened,
          amen_count: nowAmened ? p.amen_count + 1 : Math.max(0, p.amen_count - 1),
        };
      }),
    );
    try {
      await amenPost(postId, session.access_token);
    } catch {
      // Revert on failure
      setPosts(prev =>
        prev.map(p => {
          if (p.id !== postId) return p;
          const wasAmened = !p.has_amened;
          return {
            ...p,
            has_amened: wasAmened,
            amen_count: wasAmened ? p.amen_count + 1 : Math.max(0, p.amen_count - 1),
          };
        }),
      );
    }
  };

  const renderPost = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <PostItem post={item} onAmen={handleAmen} currentUserId={user?.id} />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, session],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Share, pray, and connect</Text>
        </View>

        {/* Post Composer */}
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            value={newPost}
            onChangeText={setNewPost}
            placeholder="Share a prayer, praise, or encouragement..."
            placeholderTextColor={C.muted}
            multiline
            maxLength={1000}
          />
          <View style={styles.composerActions}>
            <Text style={styles.charCount}>{newPost.length}/1000</Text>
            <GoldButton
              title="Post"
              onPress={handlePost}
              loading={posting}
              disabled={!newPost.trim()}
              size="sm"
            />
          </View>
        </View>

        {/* Posts Feed */}
        {loading ? (
          <LoadingSpinner message="Loading community..." />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={renderPost}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.gold} />
            }
            contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🙏</Text>
                <Text style={styles.emptyText}>No posts yet</Text>
                <Text style={styles.emptySubtext}>Be the first to share something with the community</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  headerTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 2,
  },
  composer: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  composerInput: {
    color: C.text,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  charCount: {
    color: C.muted,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
  },
  post: {
    backgroundColor: C.surface,
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  postHeaderText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  posterName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  timestamp: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  postContent: {
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  amenCount: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  amenCountActive: {
    color: C.gold,
  },
  separator: {
    height: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
