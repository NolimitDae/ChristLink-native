import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { makeStyles, useTheme } from '../contexts/ThemeContext';
import { getNotifications, markAllNotificationsRead } from '../lib/api';
import { timeAgo } from '../lib/format';
import { routeForNotification, setBadgeCount } from '../lib/notifications';
import type { AppNotification } from '../lib/types';
import { AppText, EmptyState, ListSkeleton, Screen } from '../components/ui';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';

type IconName = AppIconName;

const ICONS: Record<string, IconName> = {
  ticket_sale: 'ticket-outline',
  refund_request: 'return-down-back-outline',
  refund_approved: 'checkmark-circle-outline',
  refund_denied: 'close-circle-outline',
  event_invite: 'mail-open-outline',
  friend_rsvp: 'people-outline',
  prayer_answered: 'sparkles-outline',
  prayer_summary: 'pray-outline',
  serve_message: 'serve-outline',
  church_claim: 'church-outline',
};

export default function NotificationsScreen() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token;
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getNotifications(token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    load().then(() => {
      markAllNotificationsRead(token).catch(() => undefined);
      setBadgeCount(0);
    });
  }, [token, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!session) {
    return (
      <Screen back title="Notifications">
        <EmptyState art="bell" title="Sign in to see notifications" body="Ticket confirmations, invites and prayer updates show up here." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  const open = (n: AppNotification) => {
    const route = routeForNotification(n.data ?? null);
    if (route && route !== '/notifications') router.push(route);
  };

  return (
    <Screen back title="Notifications">
      {items === null && !failed ? (
        <ListSkeleton rows={5} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={n => n.id}
          contentContainerStyle={{ paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
          ListEmptyComponent={
            failed ? (
              <EmptyState art="offline" title="Couldn't load notifications" body="Check your connection and try again." actionLabel="Try again" onAction={load} />
            ) : (
              <EmptyState art="bell" title="You're all caught up" body="We'll let you know about tickets, invites and prayers here." />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body ?? ''}. ${timeAgo(item.created_at)}`}
              style={({ pressed }) => [s.row, !item.read && s.unreadRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={s.icon}>
                <AppIcon name={ICONS[item.type] ?? 'notifications-outline'} size={19} color={t.c.goldText} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {item.title}
                </AppText>
                {item.body ? (
                  <AppText variant="callout" tone="muted" numberOfLines={3} style={{ marginTop: 2 }}>
                    {item.body}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone="faint" style={{ marginTop: 4 }}>
                  {timeAgo(item.created_at)}
                </AppText>
              </View>
              {!item.read ? <View style={s.dot} accessibilityElementsHidden /> : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  row: {
    flexDirection: 'row',
    gap: t.space.sm,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.sm,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: t.c.border,
  },
  unreadRow: { backgroundColor: t.c.goldDim },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.surface2,
    borderWidth: 1,
    borderColor: t.c.goldHairline,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.c.gold, marginTop: 6 },
}));
