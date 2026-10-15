import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { FeatureError, createPrayer, deletePrayer, getPrayerWall, markPrayerAnswered, prayFor } from '../../lib/features';
import type { Prayer, PrayerFilter } from '../../lib/types';
import { useReport } from '../ReportSheet';
import { AppText, BottomSheet, Button, ChipRow, EmptyState, Field, ListGroup, ListRow, Skeleton, SkeletonGroup } from '../ui';
import { ActionMenu, type MenuAction } from './ActionMenu';
import { distributeColumns, estimatePrayerHeight } from './masonry';
import { PrayerCard } from './PrayerCard';

const FILTERS: readonly PrayerFilter[] = ['all', 'church', 'friends', 'answered', 'mine'];
const FILTER_LABELS: Record<PrayerFilter, string> = {
  all: 'All',
  church: 'My church',
  friends: 'Friends',
  answered: 'Answered',
  mine: 'Mine',
};
const NEEDS_SIGN_IN: PrayerFilter[] = ['church', 'friends', 'mine'];
const MAX = 1000;
const TAB_BAR_CLEARANCE = 84;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function PrayerWall({ bottomPad }: { bottomPad: number }) {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { blockedIds, settings } = useAppData();
  const { showToast } = useToast();
  const report = useReport();
  const [filter, setFilter] = useState<PrayerFilter>('all');
  const [prayers, setPrayers] = useState<Prayer[] | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuPrayer, setMenuPrayer] = useState<Prayer | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [shareChurch, setShareChurch] = useState(false);
  const [posting, setPosting] = useState(false);

  const [answering, setAnswering] = useState<Prayer | null>(null);
  const [testimony, setTestimony] = useState('');
  const [savingAnswer, setSavingAnswer] = useState(false);

  const gated = !session && NEEDS_SIGN_IN.includes(filter);
  const noChurch = filter === 'church' && !!session && !settings?.home_church_id;

  const load = useCallback(async () => {
    if (gated || noChurch) {
      setPrayers([]);
      return;
    }
    try {
      setPrayers(await getPrayerWall(filter));
      setFailed(false);
      setNotSetUp(false);
    } catch (err) {
      if (err instanceof FeatureError && err.notSetUp) setNotSetUp(true);
      else setFailed(true);
      setPrayers(prev => prev ?? []);
    }
  }, [filter, gated, noChurch]);

  useEffect(() => {
    setPrayers(null);
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const update = useCallback(
    (id: string, fn: (p: Prayer) => Prayer) => setPrayers(prev => prev?.map(p => (p.id === id ? fn(p) : p)) ?? prev),
    [],
  );

  const onPray = useCallback(
    async (prayer: Prayer) => {
      if (!session) {
        router.push('/auth');
        return;
      }
      update(prayer.id, p => ({ ...p, has_prayed: true, prayed_count: p.prayed_count + 1 }));
      try {
        const count = await prayFor(prayer.id);
        if (typeof count === 'number') update(prayer.id, p => ({ ...p, prayed_count: count }));
      } catch (err) {
        update(prayer.id, p => ({ ...p, has_prayed: false, prayed_count: prayer.prayed_count }));
        showToast(errorMessage(err, 'Could not record your prayer'), 'error');
      }
    },
    [session, router, showToast, update],
  );

  const onMarkAnswered = useCallback((prayer: Prayer) => {
    setTestimony('');
    setAnswering(prayer);
  }, []);

  const saveAnswered = async () => {
    if (!answering) return;
    setSavingAnswer(true);
    try {
      await markPrayerAnswered(answering.id, testimony.trim());
      setAnswering(null);
      showToast('Testimony shared with the community', 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err, 'Could not mark as answered'), 'error');
    } finally {
      setSavingAnswer(false);
    }
  };

  const openCompose = () => {
    if (!session) {
      router.push('/auth');
      return;
    }
    setBody('');
    setAnonymous(false);
    setShareChurch(!!settings?.home_church_id);
    setComposeOpen(true);
  };

  const submitPrayer = async () => {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      await createPrayer(text, anonymous, shareChurch ? settings?.home_church_id : null);
      setComposeOpen(false);
      showToast('Your prayer is on the wall', 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err, 'Could not share prayer'), 'error');
    } finally {
      setPosting(false);
    }
  };

  const confirmDelete = (prayer: Prayer) => {
    Alert.alert('Delete this prayer?', 'It will be removed from the Prayer Wall.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePrayer(prayer.id);
            setPrayers(prev => prev?.filter(p => p.id !== prayer.id) ?? prev);
            showToast('Prayer deleted', 'success');
          } catch (err) {
            showToast(errorMessage(err, 'Could not delete prayer'), 'error');
          }
        },
      },
    ]);
  };

  const menuActions = (p: Prayer): MenuAction[] =>
    p.is_mine
      ? [{ label: 'Delete prayer', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(p) }]
      : [
          {
            label: 'Report prayer',
            icon: 'flag-outline',
            onPress: () =>
              report.open({ type: 'prayer', id: p.id, authorId: p.is_anonymous ? null : p.author_id, authorName: p.is_anonymous ? null : p.author_name }),
          },
        ];

  const visible = useMemo(() => (prayers ?? []).filter(p => !p.author_id || !blockedIds.has(p.author_id)), [prayers, blockedIds]);
  const [left, right] = useMemo(() => distributeColumns(visible, estimatePrayerHeight), [visible]);

  if (notSetUp) {
    return (
      <EmptyState
        art="prayer"
        title="Prayer Wall is almost ready"
        body="We're putting the finishing touches on the Prayer Wall. Check back soon."
        actionLabel="Check again"
        onAction={() => {
          setNotSetUp(false);
          load();
        }}
      />
    );
  }

  const renderBody = () => {
    if (gated) {
      return (
        <EmptyState
          art="prayer"
          title="Sign in to see these prayers"
          body="Prayers from your church, your friends and your own requests appear here once you're signed in."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      );
    }
    if (noChurch) {
      return (
        <EmptyState
          art="church"
          title="Choose your Home Church"
          body="Pick your church to pray with your congregation."
          actionLabel="Find a church"
          onAction={() => router.push('/explore?tab=churches')}
        />
      );
    }
    if (prayers === null) {
      return (
        <SkeletonGroup label="Loading prayers">
          <View style={s.columns}>
            {[0, 1].map(col => (
              <View key={col} style={[s.column, { gap: t.space.sm }]}>
                <Skeleton height={col ? 150 : 200} radius={t.radius.lg} />
                <Skeleton height={col ? 210 : 140} radius={t.radius.lg} />
              </View>
            ))}
          </View>
        </SkeletonGroup>
      );
    }
    if (failed && visible.length === 0) {
      return <EmptyState art="offline" title="Couldn't load prayers" body="Check your connection and try again." actionLabel="Try again" onAction={load} />;
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          art="prayer"
          title={filter === 'answered' ? 'No answered prayers yet' : 'No prayers here yet'}
          body="Share what's on your heart and let the community pray with you."
          actionLabel="Share a prayer"
          onAction={openCompose}
        />
      );
    }
    return (
      <View style={s.columns}>
        {[left, right].map((col, i) => (
          <View key={i} style={s.column}>
            {col.map(p => (
              <PrayerCard key={p.id} prayer={p} onPray={onPray} onMarkAnswered={onMarkAnswered} onMenu={setMenuPrayer} />
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 56 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} labels={FILTER_LABELS} style={{ paddingVertical: t.space.xs }} />
        <View style={{ height: t.space.sm }} />
        {renderBody()}
      </ScrollView>

      <View style={[s.fab, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]} pointerEvents="box-none">
        <Button title="Share a prayer" icon="add" onPress={openCompose} style={s.fabShadow} />
      </View>

      <BottomSheet
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Share a prayer"
        subtitle="The community will pray with you."
        footer={<Button title="Post to Prayer Wall" onPress={submitPrayer} loading={posting} disabled={!body.trim()} fullWidth />}
      >
        <Field value={body} onChangeText={setBody} placeholder="What can we pray for?" multiline maxLength={MAX} accessibilityLabel="Prayer request" />
        <AppText variant="caption" tone="faint" align="right" style={{ marginTop: 4, marginBottom: t.space.sm }}>
          {body.length}/{MAX}
        </AppText>
        <ListGroup>
          <ListRow
            icon="eye-off-outline"
            title="Post anonymously"
            subtitle="Your name and photo are hidden"
            toggle={anonymous}
            onToggle={setAnonymous}
            last={!settings?.home_church_id}
          />
          {settings?.home_church_id ? (
            <ListRow icon="business-outline" title="Share with my Home Church" subtitle="Shows under My church" toggle={shareChurch} onToggle={setShareChurch} last />
          ) : null}
        </ListGroup>
      </BottomSheet>

      <BottomSheet
        visible={!!answering}
        onClose={() => setAnswering(null)}
        title="Prayer answered"
        subtitle="Tell the community how God answered."
        footer={<Button title="Share testimony" icon="sparkles-outline" onPress={saveAnswered} loading={savingAnswer} disabled={!testimony.trim()} fullWidth />}
      >
        <Field value={testimony} onChangeText={setTestimony} placeholder="Share your testimony…" multiline maxLength={MAX} accessibilityLabel="Testimony" />
      </BottomSheet>

      <ActionMenu visible={!!menuPrayer} onClose={() => setMenuPrayer(null)} title="Prayer" actions={menuPrayer ? menuActions(menuPrayer) : []} />
      {report.sheet}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  columns: { flexDirection: 'row', gap: t.space.sm, paddingHorizontal: t.space.md },
  column: { flex: 1, gap: 0 },
  fab: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fabShadow: {
    shadowColor: t.c.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
}));
