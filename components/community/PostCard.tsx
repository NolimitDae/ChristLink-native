import React, { memo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, makeStyles } from '../../contexts/ThemeContext';
import { timeAgo } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { CommunityPost, CommunityReply } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, Card, IconButton } from '../ui';
import { POST_TYPE_LABEL, isShareable } from './postTypes';
import { RepliesThread } from './RepliesThread';

const DOUBLE_TAP_MS = 280;

interface PostCardProps {
  post: CommunityPost;
  onAmen: (post: CommunityPost, fromDoubleTap: boolean) => void;
  onMenu: (post: CommunityPost) => void;
  onShare: (post: CommunityPost) => void;
  onRepliesChange: (postId: string, count: number) => void;
  onReportReply: (reply: CommunityReply) => void;
}

function isVerified(role?: string): boolean {
  return role === 'verified' || role === 'admin';
}

export const PostCard = memo(function PostCard({ post, onAmen, onMenu, onShare, onRepliesChange, onReportReply }: PostCardProps) {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const answered = post.post_type === 'answered';
  const name = post.profiles?.full_name ?? 'Member';

  const playPop = () => {
    pop.setValue(t.reduceMotion ? 1 : 0);
    popOpacity.setValue(t.reduceMotion ? 0 : 1);
    if (t.reduceMotion) {
      Animated.sequence([
        Animated.timing(popOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(popOpacity, { toValue: 0, duration: 350, delay: 200, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.2, duration: 180, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(popOpacity, { toValue: 0, duration: 320, delay: 220, useNativeDriver: true }),
    ]).start();
  };

  const onBodyPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      haptic.light();
      playPop();
      onAmen(post, true);
    } else {
      lastTap.current = now;
    }
  };

  const openAuthor = () => {
    if (post.user_id) router.push(`/user/${post.user_id}`);
  };

  return (
    <Card padded={false} variant={answered ? 'featured' : 'standard'} style={s.card}>
      {answered ? (
        <View style={s.ribbon} accessibilityRole="text" accessibilityLabel="Answered prayer">
          <Ionicons name="sparkles" size={13} color={t.c.onGold} />
          <AppText variant="overline" tone="onGold" style={{ fontSize: 10 }}>
            Answered prayer
          </AppText>
        </View>
      ) : null}
      <View style={s.inner}>
        <View style={s.header}>
          <Pressable onPress={openAuthor} accessibilityRole="button" accessibilityLabel={`View ${name}'s profile`} style={s.author}>
            <Avatar uri={post.profiles?.avatar_url} name={name} color={post.profiles?.avatar_color} size={38} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {name}
                </AppText>
                {isVerified(post.profiles?.role) ? (
                  <Ionicons name="checkmark-circle" size={15} color={t.c.goldText} accessibilityLabel="Verified" />
                ) : null}
              </View>
              <AppText variant="caption" tone="faint">
                {timeAgo(post.created_at)}
              </AppText>
            </View>
          </Pressable>
          {post.post_type && !answered ? (
            <View style={s.typePill}>
              <AppText variant="caption" tone="gold" style={{ fontSize: 11 }}>
                {POST_TYPE_LABEL[post.post_type]}
              </AppText>
            </View>
          ) : null}
          <IconButton icon="ellipsis-horizontal" label="Post options" tone="plain" size={34} color={t.c.textMuted} onPress={() => onMenu(post)} />
        </View>

        <Pressable onPress={onBodyPress} accessibilityLabel={post.content} accessibilityHint="Double tap quickly to say Amen">
          <AppText variant="body" style={{ marginTop: t.space.sm }}>
            {post.content}
          </AppText>
          <Animated.View pointerEvents="none" style={[s.popWrap, { opacity: popOpacity }]} importantForAccessibility="no-hide-descendants">
            <Animated.View style={[s.popBadge, { transform: [{ scale: pop }] }]}>
              <Ionicons name="heart" size={40} color={t.c.gold} />
            </Animated.View>
          </Animated.View>
        </Pressable>

        <View style={s.actions}>
          <Pressable
            onPress={() => {
              haptic.light();
              onAmen(post, false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: !!post.has_amened }}
            accessibilityLabel={`Amen, ${post.amen_count}`}
            style={s.action}
          >
            <Ionicons name={post.has_amened ? 'heart' : 'heart-outline'} size={19} color={post.has_amened ? t.c.gold : t.c.textMuted} />
            <AppText variant="caption" tone={post.has_amened ? 'gold' : 'muted'}>
              Amen{post.amen_count > 0 ? ` · ${post.amen_count}` : ''}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setExpanded(e => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`Replies, ${post.reply_count}`}
            style={s.action}
          >
            <Ionicons name={expanded ? 'chatbubble' : 'chatbubble-outline'} size={18} color={expanded ? t.c.goldText : t.c.textMuted} />
            <AppText variant="caption" tone={expanded ? 'gold' : 'muted'}>
              {post.reply_count > 0 ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </AppText>
          </Pressable>
          {isShareable(post.post_type) ? (
            <Pressable onPress={() => onShare(post)} accessibilityRole="button" accessibilityLabel="Share testimony" style={s.action}>
              <Ionicons name="share-outline" size={18} color={t.c.textMuted} />
              <AppText variant="caption" tone="muted">
                Share
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {expanded ? (
          <RepliesThread postId={post.id} onCountChange={n => onRepliesChange(post.id, n)} onReportReply={onReportReply} />
        ) : null}
      </View>
    </Card>
  );
});

const useStyles = makeStyles(t => ({
  card: { marginHorizontal: t.space.md },
  inner: { padding: t.space.md },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: t.c.gold,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  typePill: {
    borderWidth: 1,
    borderColor: t.c.goldHairline,
    borderRadius: t.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  popWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  popBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.goldDim,
    borderWidth: 1,
    borderColor: t.c.goldHairline,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: t.space.lg, marginTop: t.space.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
}));
