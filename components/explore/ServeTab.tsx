import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { getOpenShifts } from '../../lib/features';
import { formatDateLong, formatTimeRange } from '../../lib/format';
import type { ServeShift } from '../../lib/types';
import { AppText, BottomSheet, Button, EmptyState, ListSkeleton } from '../ui';
import { errorMessage, isNotSetUp } from '../church/churchFormat';
import { ShiftCard, shiftPlace } from '../serve/ShiftCard';
import { SpotsBar } from '../serve/SpotsBar';
import { useShiftActions } from '../serve/useShiftActions';

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string } | { kind: 'notSetUp' };

function Separator() {
  return <View style={{ height: 12 }} />;
}

export function ServeTab({ bottomInset, onFindChurch }: { bottomInset: number; onFindChurch: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [shifts, setShifts] = useState<ServeShift[]>([]);
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<ServeShift | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getOpenShifts();
      setShifts(list.filter(s => new Date(s.ends_at).getTime() > Date.now()));
      setState({ kind: 'ready' });
    } catch (err) {
      setState(isNotSetUp(err) ? { kind: 'notSetUp' } : { kind: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback((shiftId: string, p: Partial<ServeShift>) => {
    setShifts(prev => prev.map(s => (s.shift_id === shiftId ? { ...s, ...p } : s)));
  }, []);
  const actions = useShiftActions(patch);

  const sections = useMemo(() => {
    const groups = new Map<string, ServeShift[]>();
    [...shifts]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .forEach(s => {
        const key = new Date(s.starts_at).toDateString();
        const list = groups.get(key);
        if (list) list.push(s);
        else groups.set(key, [s]);
      });
    return [...groups.values()].map(data => ({ title: formatDateLong(data[0].starts_at), data }));
  }, [shifts]);

  if (state.kind === 'loading') return <ListSkeleton rows={4} />;
  if (state.kind === 'notSetUp') {
    return (
      <EmptyState
        art="serve"
        title="Serve sign-ups are coming soon"
        body="Soon you’ll be able to sign up to greet, set up, lead worship and more at events and churches near you."
      />
    );
  }
  if (state.kind === 'error') {
    return <EmptyState art="offline" title="We couldn’t load shifts" body={state.message} actionLabel="Try again" onAction={load} />;
  }

  const live = confirm ? (shifts.find(s => s.shift_id === confirm.shift_id) ?? confirm) : null;

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={s => s.shift_id}
        contentContainerStyle={{ padding: t.space.md, paddingBottom: bottomInset, flexGrow: 1 }}
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
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
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push('/serve')}
            accessibilityRole="link"
            accessibilityLabel="My shifts and hours"
            style={({ pressed }) => [
              styles.link,
              { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline, borderRadius: t.radius.md, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="hand-left-outline" size={18} color={t.c.goldText} />
            <AppText variant="bodyStrong" tone="gold" style={{ flex: 1 }}>
              My shifts & hours
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={t.c.goldText} />
          </Pressable>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="overline" tone="muted" style={styles.sectionHeader} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <ShiftCard
            shift={item}
            busy={actions.busyId === item.shift_id}
            onSignUp={() => setConfirm(item)}
            onCancel={() => actions.cancel(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            art="serve"
            title="No open shifts right now"
            body="Churches and hosts post serve roles here. Follow your church to hear when they need a hand."
            actionLabel="Find a church"
            onAction={onFindChurch}
          />
        }
      />

      <BottomSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={live?.role_name ?? 'Serve'}
        subtitle={live ? shiftPlace(live) : undefined}
        footer={
          live ? (
            <Button
              title="Sign me up"
              icon="checkmark"
              fullWidth
              loading={actions.busyId === live.shift_id}
              onPress={async () => {
                const ok = await actions.signUp(live);
                if (ok) setConfirm(null);
              }}
            />
          ) : null
        }
      >
        {live ? (
          <View style={{ gap: t.space.md, paddingBottom: t.space.sm }}>
            <View style={styles.detail}>
              <Ionicons name="calendar-outline" size={18} color={t.c.goldText} />
              <AppText variant="body" style={{ flex: 1 }}>
                {formatDateLong(live.starts_at)}
                {'\n'}
                <AppText variant="callout" tone="muted">
                  {formatTimeRange(live.starts_at, live.ends_at)}
                </AppText>
              </AppText>
            </View>
            {live.description ? (
              <AppText variant="body" tone="muted">
                {live.description}
              </AppText>
            ) : null}
            <View style={[styles.req, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.md }]}>
              <AppText variant="overline" tone="gold">
                What to know
              </AppText>
              <AppText variant="callout">{live.requirements || 'No special requirements. Just bring a willing heart.'}</AppText>
            </View>
            <SpotsBar spots={live.spots} taken={live.taken} />
            <AppText variant="caption" tone="faint">
              We’ll remind you the day before and two hours before your shift.
            </AppText>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52, borderWidth: 1, marginBottom: 4 },
  sectionHeader: { marginTop: 20, marginBottom: 10 },
  detail: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  req: { padding: 14, gap: 6, borderWidth: 1 },
});
