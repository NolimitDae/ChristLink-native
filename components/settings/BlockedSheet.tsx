import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getPublicProfile } from '../../lib/api';
import { unblockUser } from '../../lib/features';
import type { PersonSummary } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, BottomSheet, Button, EmptyState, Skeleton } from '../ui';

export function BlockedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { session } = useAuth();
  const { blockedIds, refreshBlocked } = useAppData();
  const { showToast } = useToast();
  const [people, setPeople] = useState<PersonSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const ids = [...blockedIds];
    setPeople(null);
    Promise.allSettled(ids.map(id => getPublicProfile(id, token))).then(results => {
      if (cancelled) return;
      setPeople(
        ids.map((id, i) => {
          const r = results[i];
          return r.status === 'fulfilled'
            ? { id, full_name: r.value.full_name, avatar_url: r.value.avatar_url, avatar_color: r.value.avatar_color }
            : { id, full_name: 'Christ Link member' };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [visible, blockedIds, token]);

  const unblock = async (person: PersonSummary) => {
    setBusyId(person.id);
    try {
      await unblockUser(person.id);
      await refreshBlocked();
      showToast(`Unblocked ${person.full_name}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not unblock', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Blocked accounts" subtitle="They can't see your posts or message you.">
      {people === null ? (
        <View style={{ gap: t.space.sm }} accessibilityLabel="Loading blocked accounts">
          <Skeleton height={44} />
          <Skeleton height={44} />
        </View>
      ) : people.length === 0 ? (
        <EmptyState compact art="people" title="No blocked accounts" body="People you block will appear here." />
      ) : (
        people.map(p => (
          <View
            key={p.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: 56, borderBottomWidth: 1, borderBottomColor: t.c.border }}
          >
            <Avatar uri={p.avatar_url} name={p.full_name} color={p.avatar_color} size={36} />
            <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {p.full_name}
            </AppText>
            <Button title="Unblock" size="sm" variant="secondary" onPress={() => unblock(p)} loading={busyId === p.id} />
          </View>
        ))
      )}
    </BottomSheet>
  );
}
