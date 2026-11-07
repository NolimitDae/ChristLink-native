import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { FeatureError, getServeHistory, type ServeHistoryItem } from '../../lib/features';
import { AppText, EmptyState, ListSkeleton, Screen } from '../../components/ui';
import { AppIcon } from '../../components/icons/AppIcon';
import { LoadError } from '../../components/LoadError';
import { loadFailure, type LoadFailure } from '../../lib/loadFailure';

function formatHours(h: number): string {
  return h < 10 ? String(Math.round(h * 10) / 10) : String(Math.round(h));
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Hours served, shift by shift (opened from "Hours served" on your profile). Only completed shifts count. */
export default function ServeHistoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<ServeHistoryItem[] | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [failed, setFailed] = useState<LoadFailure | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getServeHistory());
      setFailed(null);
    } catch (err) {
      if (err instanceof FeatureError && err.notSetUp) setNotSetUp(true);
      else setFailed(loadFailure(err));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = (items ?? []).reduce((n, i) => n + (Number(i.hours) || 0), 0);

  return (
    <Screen back title="Hours served">
      {items === null ? (
        <ListSkeleton rows={5} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.signup_id}
          contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: 48, flexGrow: 1 }}
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={{ paddingVertical: t.space.md }}>
                <AppText variant="display">{formatHours(total)} hours</AppText>
                <AppText variant="callout" tone="muted">
                  Across {items.length} {items.length === 1 ? 'shift' : 'shifts'}. Only you can see this.
                </AppText>
              </View>
            ) : undefined
          }
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.border }} />}
          ListEmptyComponent={
            failed ? (
              <LoadError failure={failed} what="your shifts" art="serve" onRetry={load} />
            ) : (
              <EmptyState
                art="serve"
                title={notSetUp ? 'Serve history is almost ready' : 'No completed shifts yet'}
                body="Hours count once a shift leader marks your shift complete."
                actionLabel="Find a place to serve"
                onAction={() => router.push('/(tabs)/explore?tab=serve')}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row} accessible accessibilityLabel={`${item.role_name}, ${item.event_name ?? item.church_name ?? ''}, ${when(item.starts_at)}, ${formatHours(item.hours)} hours`}>
              <AppIcon name="serve-outline" size={20} color={t.c.textMuted} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.role_name}
                </AppText>
                {item.event_name || item.church_name ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {item.event_name ?? item.church_name}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone="faint">
                  {when(item.starts_at)}
                </AppText>
              </View>
              <AppText variant="headline">{formatHours(item.hours)} h</AppText>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12 },
});
