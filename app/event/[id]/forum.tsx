import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppData } from '../../../contexts/AppDataContext';
import { useToast } from '../../../contexts/ToastContext';
import { getEvent, getForum, postForum } from '../../../lib/api';
import { haptic } from '../../../lib/haptics';
import { logger } from '../../../lib/logger';
import { timeAgo } from '../../../lib/format';
import type { Event, ForumMessage } from '../../../lib/types';
import { useReport } from '../../../components/ReportSheet';
import { Avatar } from '../../../components/Avatar';
import { AppText, EmptyState, Field, Screen, Skeleton, SkeletonGroup } from '../../../components/ui';
import { useAttendance } from '../../../components/event/useAttendance';

const POLL_MS = 8000;

function byNewest(a: ForumMessage, b: ForumMessage): number {
  return b.created_at.localeCompare(a.created_at);
}

export default function EventForumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, profile } = useAuth();
  const token = session?.access_token;
  const { blockedIds } = useAppData();
  const { showToast } = useToast();
  const report = useReport();
  const attendance = useAttendance(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [eventFailed, setEventFailed] = useState(false);
  const [messages, setMessages] = useState<ForumMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    getEvent(id, token)
      .then(setEvent)
      .catch(err => {
        logger.warn('Forum event load failed', { error: String(err) });
        setEventFailed(true);
      });
  }, [id, token]);

  const isHost = !!user && !!event && event.host_id === user.id;
  const allowed = !!token && (isHost || attendance.attending);

  const fetchMessages = useCallback(async () => {
    if (!id || !token) return;
    try {
      const list = await getForum(id, token);
      setMessages([...list].sort(byNewest));
    } catch (err) {
      logger.info('Forum fetch failed', { error: String(err) });
      setMessages(prev => prev ?? []);
    }
  }, [id, token]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return undefined;
      fetchMessages();
      const timer = setInterval(fetchMessages, POLL_MS);
      return () => clearInterval(timer);
    }, [allowed, fetchMessages]),
  );

  const visible = useMemo(() => (messages ?? []).filter(m => !blockedIds.has(m.user_id)), [messages, blockedIds]);

  const send = async () => {
    const body = text.trim();
    if (!body || !id || !token || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await postForum(id, body, token);
      const msg: ForumMessage = {
        ...res,
        id: res?.id ?? `local-${Date.now()}`,
        event_id: id,
        user_id: res?.user_id ?? user?.id ?? '',
        content: res?.content ?? body,
        created_at: res?.created_at ?? new Date().toISOString(),
        profiles:
          res?.profiles ??
          (profile ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, avatar_color: profile.avatar_color } : undefined),
      };
      setMessages(prev => [msg, ...(prev ?? []).filter(m => m.id !== msg.id)]);
      setText('');
      haptic.light();
    } catch (err) {
      haptic.error();
      showToast(err instanceof Error ? err.message : 'Message not sent', 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const title = event?.name ?? 'Discussion';
  const decided = (!!event || eventFailed) && (!token || attendance.loaded);

  if (!token) {
    return (
      <Screen title={title} back>
        <EmptyState art="people" title="Sign in to join the conversation" body="Event discussions are for people who are going." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  if (!decided) {
    return (
      <Screen title={title} back>
        <ForumSkeleton />
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen title={title} back>
        <EmptyState
          art="people"
          title="RSVP to join the conversation"
          body="Once you’re going, you can chat with the host and other guests here."
          actionLabel="View event"
          onAction={() => (router.canGoBack() ? router.back() : router.replace(`/event/${id}`))}
        />
      </Screen>
    );
  }

  return (
    <Screen title={title} back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {messages === null ? (
          <ForumSkeleton />
        ) : visible.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState art="people" title="Start the conversation" body="Say hello, share a ride, or ask the host a question." />
          </View>
        ) : (
          <FlatList
            inverted
            data={visible}
            keyExtractor={m => m.id}
            contentContainerStyle={{ paddingHorizontal: t.space.md, paddingVertical: t.space.sm }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => {
              const older = visible[index + 1];
              const showAuthor = !older || older.user_id !== item.user_id;
              const mine = item.user_id === user?.id;
              return (
                <MessageBubble
                  message={item}
                  mine={mine}
                  showAuthor={showAuthor}
                  isHostMessage={item.user_id === event?.host_id}
                  onReport={
                    mine
                      ? undefined
                      : () => {
                          haptic.medium();
                          report.open({ type: 'forum_message', id: item.id, authorId: item.user_id, authorName: item.profiles?.full_name });
                        }
                  }
                />
              );
            }}
          />
        )}
        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, t.space.sm), borderTopColor: t.c.border }]}>
          <Field
            containerStyle={{ flex: 1 }}
            placeholder="Message everyone going"
            value={text}
            onChangeText={setText}
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={send}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
            style={({ pressed }) => [s.send, { backgroundColor: t.c.gold, opacity: !text.trim() || sending ? 0.4 : pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="arrow-up" size={22} color={t.c.onGold} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {report.sheet}
    </Screen>
  );
}

function MessageBubble({
  message,
  mine,
  showAuthor,
  isHostMessage,
  onReport,
}: {
  message: ForumMessage;
  mine: boolean;
  showAuthor: boolean;
  isHostMessage: boolean;
  onReport?: () => void;
}) {
  const t = useTheme();
  const s = useStyles();
  const name = message.profiles?.full_name ?? 'Guest';
  const bubble = (
    <Pressable
      onLongPress={onReport}
      delayLongPress={350}
      accessibilityRole="text"
      accessibilityLabel={`${mine ? 'You' : name}: ${message.content}. ${timeAgo(message.created_at)}`}
      accessibilityHint={onReport ? 'Long press to report' : undefined}
      accessibilityActions={onReport ? [{ name: 'longpress', label: 'Report message' }] : undefined}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'longpress') onReport?.();
      }}
      style={[
        s.bubble,
        mine
          ? { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline, borderBottomRightRadius: 6, maxWidth: '82%' }
          : { backgroundColor: t.c.surface, borderColor: t.c.border, borderBottomLeftRadius: 6 },
      ]}
    >
      <AppText variant="body" selectable={false}>
        {message.content}
      </AppText>
      <AppText variant="caption" tone="faint" style={{ marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start', fontSize: 11 }}>
        {timeAgo(message.created_at)}
      </AppText>
    </Pressable>
  );

  if (mine) {
    return <View style={[s.row, { justifyContent: 'flex-end', marginTop: showAuthor ? t.space.sm : 2 }]}>{bubble}</View>;
  }
  return (
    <View style={[s.row, { marginTop: showAuthor ? t.space.sm : 2 }]}>
      <View style={{ width: 32 }}>
        {showAuthor ? <Avatar uri={message.profiles?.avatar_url} name={name} color={message.profiles?.avatar_color} size={32} /> : null}
      </View>
      <View style={{ flexShrink: 1, maxWidth: '80%', alignItems: 'flex-start' }}>
        {showAuthor ? (
          <View style={s.authorRow}>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {name}
            </AppText>
            {isHostMessage ? (
              <AppText variant="overline" tone="gold" style={{ fontSize: 9 }}>
                Host
              </AppText>
            ) : null}
          </View>
        ) : null}
        {bubble}
      </View>
    </View>
  );
}

function ForumSkeleton() {
  const t = useTheme();
  return (
    <SkeletonGroup label="Loading messages">
      <View style={{ padding: t.space.md, gap: t.space.md }}>
        {[0.6, 0.45, 0.7, 0.5].map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: t.space.xs, justifyContent: i % 2 ? 'flex-end' : 'flex-start' }}>
            {i % 2 ? null : <Skeleton width={32} height={32} radius={16} />}
            <Skeleton width={`${w * 100}%`} height={48} radius={t.radius.lg} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: t.space.xs },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 },
  bubble: { paddingHorizontal: t.space.sm, paddingVertical: t.space.xs, borderRadius: t.radius.lg, borderWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space.xs,
    paddingHorizontal: t.space.md,
    paddingTop: t.space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: t.c.bg,
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
}));
