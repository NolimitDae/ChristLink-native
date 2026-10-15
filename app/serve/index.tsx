import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { AppText, EmptyState, Screen, Skeleton, SkeletonGroup, StatTile } from '../../components/ui';
import { VolunteerPass } from '../../components/serve/VolunteerPass';
import { isMyShift, useShiftActions } from '../../components/serve/useShiftActions';
import { errorMessage, isNotSetUp } from '../../components/church/churchFormat';
import { getHoursServed, getOpenShifts } from '../../lib/features';
import type { ServeShift } from '../../lib/types';

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'notSetUp' } | { kind: 'error'; message: string };

function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export default function ServeScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [shifts, setShifts] = useState<ServeShift[]>([]);
  const [hours, setHours] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [list, h] = await Promise.all([getOpenShifts(), getHoursServed()]);
      setShifts(list);
      setHours(h);
      setState({ kind: 'ready' });
    } catch (err) {
      setState(isNotSetUp(err) ? { kind: 'notSetUp' } : { kind: 'error', message: errorMessage(err) });
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback((shiftId: string, p: Partial<ServeShift>) => {
    setShifts(prev => prev.map(s => (s.shift_id === shiftId ? { ...s, ...p } : s)));
  }, []);
  const actions = useShiftActions(patch);

  const mine = useMemo(
    () =>
      shifts
        .filter(s => isMyShift(s) && new Date(s.ends_at).getTime() > Date.now())
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [shifts],
  );

  const openShifts = () => router.push('/(tabs)/explore?tab=serve');

  if (!session) {
    return (
      <Screen title="Serve" back>
        <EmptyState
          art="serve"
          title="Sign in to serve"
          body="Sign up for shifts at events and churches, get a volunteer pass, and track your hours."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      </Screen>
    );
  }

  if (state.kind === 'notSetUp') {
    return (
      <Screen title="Serve" back>
        <EmptyState art="serve" title="Serve sign-ups are coming soon" body="Soon you’ll be able to sign up for shifts and track your hours here." />
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen title="Serve" back>
        <EmptyState art="offline" title="We couldn’t load your shifts" body={state.message} actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  return (
    <Screen title="Serve" back>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.c.gold}
            colors={[t.c.gold]}
          />
        }
      >
        {state.kind === 'loading' ? (
          <SkeletonGroup label="Loading your shifts">
            <View style={{ gap: t.space.md }}>
              <Skeleton height={92} radius={20} />
              <Skeleton width="45%" height={18} />
              <Skeleton height={380} radius={20} />
            </View>
          </SkeletonGroup>
        ) : (
          <>
            <View style={styles.stats}>
              <StatTile label="Hours served" value={formatHours(hours)} tone="gold" />
              <StatTile label="Upcoming shifts" value={String(mine.length)} />
            </View>

            <View style={{ gap: t.space.sm }}>
              <AppText variant="title3">My upcoming shifts</AppText>
              {mine.length === 0 ? (
                <EmptyState
                  art="serve"
                  title="No upcoming shifts"
                  body="Greeters, setup crews, worship teams and more — find a place to serve this week."
                  actionLabel="Find open shifts"
                  onAction={openShifts}
                  compact
                />
              ) : (
                <View style={{ gap: t.space.md }}>
                  {mine.map(s => (
                    <VolunteerPass key={s.shift_id} shift={s} busy={actions.busyId === s.shift_id} onCancel={() => actions.cancel(s)} />
                  ))}
                </View>
              )}
            </View>

            {mine.length > 0 ? (
              <Pressable
                onPress={openShifts}
                accessibilityRole="link"
                accessibilityLabel="Browse open shifts"
                style={({ pressed }) => [
                  styles.link,
                  { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.md, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="hand-left-outline" size={18} color={t.c.goldText} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  Open shifts
                </AppText>
                <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52, borderWidth: 1 },
});
