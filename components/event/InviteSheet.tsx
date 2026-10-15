import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFollowers, inviteFollowers } from '../../lib/api';
import { getMyFriends } from '../../lib/features';
import { eventShareUrl } from '../../lib/eventHelpers';
import { haptic } from '../../lib/haptics';
import { logger } from '../../lib/logger';
import type { PersonSummary } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText } from '../ui/AppText';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Field } from '../ui/Field';
import { Skeleton, SkeletonGroup } from '../ui/Skeleton';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}

export function InviteSheet({ visible, onClose, eventId, eventName }: InviteSheetProps) {
  const t = useTheme();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;
  const [people, setPeople] = useState<PersonSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    setPicked(new Set());
    setQuery('');
    (async () => {
      let list: PersonSummary[] = [];
      try {
        list = await getMyFriends();
      } catch {
        try {
          list = await getFollowers(token);
        } catch (err) {
          logger.warn('Invite list not loaded', { error: String(err) });
        }
      }
      if (!cancelled) setPeople(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = people ?? [];
    return q ? list.filter(p => p.full_name.toLowerCase().includes(q)) : list;
  }, [people, query]);

  const toggle = (id: string) => {
    haptic.tap();
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!token || picked.size === 0 || sending) return;
    setSending(true);
    try {
      const res = await inviteFollowers(eventId, [...picked], token);
      haptic.success();
      showToast(`Invited ${res.sent ?? picked.size}`, 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send invites', 'error');
    } finally {
      setSending(false);
    }
  };

  const shareLink = async () => {
    const url = eventShareUrl(eventId);
    try {
      await Share.share({ message: `Join me at ${eventName}: ${url}`, url });
    } catch (err) {
      logger.warn('Share failed', { error: String(err) });
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Invite friends"
      subtitle={eventName}
      footer={
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <Button title="Share link" icon="link-outline" variant="secondary" onPress={shareLink} style={{ flex: 1 }} fullWidth />
          <Button
            title={picked.size > 0 ? `Invite ${picked.size}` : 'Invite'}
            icon="paper-plane-outline"
            onPress={send}
            loading={sending}
            disabled={picked.size === 0}
            style={{ flex: 1 }}
            fullWidth
          />
        </View>
      }
    >
      <Field
        placeholder="Search friends"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        accessibilityLabel="Search friends"
        left={<Ionicons name="search" size={18} color={t.c.textFaint} />}
        containerStyle={{ marginBottom: t.space.sm }}
      />
      {people === null ? (
        <SkeletonGroup label="Loading friends">
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={40} height={40} radius={20} />
              <Skeleton width="50%" height={14} />
            </View>
          ))}
        </SkeletonGroup>
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          art="people"
          title={people.length === 0 ? 'No friends yet' : 'No matches'}
          body={people.length === 0 ? 'Share the link instead — anyone can open it.' : 'Try a different name.'}
        />
      ) : (
        filtered.map(p => {
          const on = picked.has(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => toggle(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.full_name}
              style={({ pressed }) => [styles.row, { borderBottomColor: t.c.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Avatar uri={p.avatar_url} name={p.full_name} color={p.avatar_color} size={40} />
              <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {p.full_name}
              </AppText>
              <View style={[styles.check, { borderColor: on ? t.c.gold : t.c.borderStrong, backgroundColor: on ? t.c.gold : 'transparent' }]}>
                {on ? <Ionicons name="checkmark" size={16} color={t.c.onGold} /> : null}
              </View>
            </Pressable>
          );
        })
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
