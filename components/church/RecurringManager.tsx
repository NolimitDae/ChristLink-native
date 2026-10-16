import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteRecurring, getChurchRecurring, saveRecurring } from '../../lib/features';
import { EVENT_TYPES } from '../../lib/constants';
import { describeRule, WEEKDAYS, type Frequency } from '../../lib/recurrence';
import { haptic } from '../../lib/haptics';
import type { ChurchRecurringEvent } from '../../lib/types';
import { AppText, BottomSheet, Button, Chip, ChipRow, Field, IconButton, ListRow, Segmented, Skeleton } from '../ui';
import { errorMessage, todayYmd } from './churchFormat';
import { TimeField } from './TimeField';

const TYPES = EVENT_TYPES.filter(x => x !== 'All');
type GatheringType = (typeof TYPES)[number];
const DURATIONS = [30, 60, 90, 120, 180];

interface Draft {
  name: string;
  event_type: GatheringType;
  frequency: Frequency;
  weekday: number;
  day_of_month: number;
  start_time: string;
  duration_minutes: number;
  location: string;
  is_service: boolean;
}

const EMPTY: Draft = {
  name: '',
  event_type: 'Worship',
  frequency: 'weekly',
  weekday: 0,
  day_of_month: 1,
  start_time: '10:00',
  duration_minutes: 90,
  location: '',
  is_service: false,
};

export function RecurringManager({ churchId }: { churchId: string }) {
  const t = useTheme();
  const { showToast } = useToast();
  const [items, setItems] = useState<ChurchRecurringEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getChurchRecurring(churchId));
    } catch {
      setItems([]);
    }
  }, [churchId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setDraft(prev => ({ ...prev, [k]: val }));

  const save = async () => {
    if (!draft.name.trim()) {
      setNameError('Give this gathering a name');
      return;
    }
    setNameError(null);
    setBusy(true);
    try {
      await saveRecurring({
        church_id: churchId,
        name: draft.name.trim(),
        event_type: draft.event_type,
        frequency: draft.frequency,
        weekday: draft.frequency === 'monthly' ? null : draft.weekday,
        day_of_month: draft.frequency === 'monthly' ? draft.day_of_month : null,
        start_time: draft.start_time,
        duration_minutes: draft.duration_minutes,
        starts_on: todayYmd(),
        location: draft.location.trim() || null,
        is_service: draft.is_service,
      });
      haptic.success();
      showToast('Gathering added', 'success');
      setOpen(false);
      setDraft(EMPTY);
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = (item: ChurchRecurringEvent) => {
    Alert.alert('Remove gathering?', `“${item.name}” will no longer show on your church page.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurring(item.id);
            setItems(prev => (prev ?? []).filter(x => x.id !== item.id));
          } catch (err) {
            showToast(errorMessage(err), 'error');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <AppText variant="overline" tone="gold">
        Recurring gatherings
      </AppText>
      <AppText variant="caption" tone="muted">
        Weekly services, studies and prayer meetings. They appear on your page and members’ Home screens.
      </AppText>
      {items === null ? (
        <Skeleton height={56} radius={14} />
      ) : items.length > 0 ? (
        <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
          {items.map((r, i) => (
            <View key={r.id} style={[styles.row, { borderBottomColor: t.c.border, borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {r.name}
                  {r.is_service ? (
                    <AppText variant="caption" tone="gold">
                      {'  '}Service
                    </AppText>
                  ) : null}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {describeRule(r)} · {r.duration_minutes} min
                </AppText>
              </View>
              <IconButton icon="trash-outline" label={`Remove ${r.name}`} size={36} tone="plain" color={t.c.danger} onPress={() => remove(r)} />
            </View>
          ))}
        </View>
      ) : null}
      <Button title="Add a gathering" icon="add" variant="secondary" size="sm" onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start' }} />

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="New recurring gathering"
        footer={<Button title="Save gathering" fullWidth onPress={save} loading={busy} />}
      >
        <View style={{ gap: t.space.md, paddingBottom: t.space.sm }}>
          <Field label="Name" value={draft.name} onChangeText={v => set('name', v)} placeholder="Wednesday Bible Study" error={nameError} />
          <View style={{ gap: 6, marginHorizontal: -t.space.md }}>
            <AppText variant="caption" tone="muted" style={{ marginLeft: t.space.md, fontSize: 13 }}>
              Type
            </AppText>
            <ChipRow options={TYPES} value={draft.event_type} onChange={v => set('event_type', v)} />
          </View>
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
              How often
            </AppText>
            <Segmented<Frequency>
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Every 2 weeks' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              value={draft.frequency}
              onChange={v => set('frequency', v)}
            />
          </View>
          {draft.frequency === 'monthly' ? (
            <View style={{ gap: 6 }}>
              <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
                Day of the month
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <Chip key={d} label={String(d)} selected={draft.day_of_month === d} onPress={() => set('day_of_month', d)} />
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
                Day
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {WEEKDAYS.map((d, i) => (
                  <Chip key={d} label={d.slice(0, 3)} selected={draft.weekday === i} onPress={() => set('weekday', i)} />
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
              Starts at
            </AppText>
            <TimeField label="Start time" value={draft.start_time} onChange={v => set('start_time', v)} />
          </View>
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
              Length
            </AppText>
            <View style={styles.wrap}>
              {DURATIONS.map(m => (
                <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60} hr`} selected={draft.duration_minutes === m} onPress={() => set('duration_minutes', m)} />
              ))}
            </View>
          </View>
          <Field label="Location (optional)" value={draft.location} onChangeText={v => set('location', v)} placeholder="Fellowship Hall" />
          <ListRow
            title="This is a worship service"
            subtitle="Shown with your service times"
            toggle={draft.is_service}
            onToggle={v => set('is_service', v)}
            last
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, minHeight: 56 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
