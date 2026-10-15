import React from 'react';
import { View } from 'react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import type { ManagedShift } from '../../lib/features';
import { formatDateShort, formatTimeRange } from '../../lib/format';
import type { ServeRosterEntry } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText, Badge, Button, Card, Field, IconButton } from '../ui';
import { DateTimeField } from './DateTimeField';

export function ShiftCard({
  shift,
  filled,
  onRoster,
  onMessage,
  onComplete,
  onCheckIn,
}: {
  shift: ManagedShift;
  filled: number | null;
  onRoster: () => void;
  onMessage: () => void;
  onComplete: () => void;
  onCheckIn: () => void;
}) {
  const t = useTheme();
  const s = useStyles();
  const pct = filled === null || shift.spots <= 0 ? 0 : Math.min(1, filled / shift.spots);
  const started = new Date(shift.starts_at).getTime() <= Date.now();
  const done = !!shift.completed_at;
  return (
    <Card style={{ gap: t.space.sm }}>
      <View style={s.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">{shift.serve_roles.name}</AppText>
          <AppText variant="caption" tone="muted">
            {formatDateShort(shift.starts_at)} · {formatTimeRange(shift.starts_at, shift.ends_at)}
          </AppText>
        </View>
        {done ? <Badge label="Completed" tone="success" /> : started ? <Badge label="Underway" tone="gold" /> : null}
      </View>
      <View style={{ gap: 6 }}>
        <View style={s.between}>
          <AppText variant="caption" tone="muted">
            Volunteers
          </AppText>
          <AppText variant="caption" tone={pct >= 1 ? 'success' : 'gold'}>
            {filled === null ? '–' : filled}/{shift.spots} filled
          </AppText>
        </View>
        <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: shift.spots, now: filled ?? 0 }}>
          <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? t.c.success : t.c.gold }]} />
        </View>
      </View>
      <View style={s.actions}>
        <Button title="Roster" icon="people-outline" size="sm" variant="secondary" onPress={onRoster} />
        <Button title="Message" icon="chatbubble-outline" size="sm" variant="secondary" onPress={onMessage} />
        {!done ? <Button title="Check in" icon="qr-code-outline" size="sm" variant="secondary" onPress={onCheckIn} /> : null}
        {!done && started ? <Button title="Complete" icon="checkmark-done" size="sm" onPress={onComplete} /> : null}
      </View>
    </Card>
  );
}

const ROSTER_TONE: Record<ServeRosterEntry['status'], 'neutral' | 'gold' | 'success' | 'danger'> = {
  signed_up: 'neutral',
  checked_in: 'gold',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
};

export function RosterRow({ entry, last }: { entry: ServeRosterEntry; last?: boolean }) {
  const s = useStyles();
  const name = entry.profiles?.full_name;
  return (
    <View style={[s.rosterRow, !last && s.divider]}>
      <Avatar uri={entry.profiles?.avatar_url} name={name ?? entry.code} color={entry.profiles?.avatar_color} size={36} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name ?? `Volunteer ${entry.code}`}
        </AppText>
        <AppText variant="caption" tone="muted">
          Pass {entry.code}
        </AppText>
      </View>
      <Badge label={entry.status.replace('_', ' ')} tone={ROSTER_TONE[entry.status]} />
    </View>
  );
}

export interface ShiftDraft {
  key: string;
  start: Date | null;
  end: Date | null;
  spots: string;
}

export interface RoleDraft {
  name: string;
  description: string;
  requirements: string;
  shifts: ShiftDraft[];
}

let seq = 0;
export function newShift(start?: Date | null, end?: Date | null): ShiftDraft {
  seq += 1;
  return { key: `s${seq}`, start: start ?? null, end: end ?? null, spots: '4' };
}

export function validateRole(r: RoleDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (r.name.trim().length < 2) e.name = 'Name this role, e.g. Greeter';
  if (r.shifts.length === 0) e.shifts = 'Add at least one shift';
  r.shifts.forEach(sh => {
    if (!sh.start) e[`start_${sh.key}`] = 'Choose a start';
    if (!sh.end) e[`end_${sh.key}`] = 'Choose an end';
    else if (sh.start && sh.end.getTime() <= sh.start.getTime()) e[`end_${sh.key}`] = 'End must be after the start';
    const n = Number(sh.spots);
    if (!Number.isInteger(n) || n < 1) e[`spots_${sh.key}`] = 'At least 1';
  });
  return e;
}

export function RoleForm({ draft, onChange, errors, defaultStart, defaultEnd }: { draft: RoleDraft; onChange: (d: RoleDraft) => void; errors: Record<string, string>; defaultStart?: Date | null; defaultEnd?: Date | null }) {
  const t = useTheme();
  const setShift = (key: string, patch: Partial<ShiftDraft>) => {
    onChange({ ...draft, shifts: draft.shifts.map(sh => (sh.key === key ? { ...sh, ...patch } : sh)) });
  };
  return (
    <View style={{ gap: t.space.md }}>
      <Field label="Role name" value={draft.name} onChangeText={name => onChange({ ...draft, name })} placeholder="Greeter, Worship tech, Kids check-in…" error={errors.name} maxLength={60} />
      <Field label="Description" value={draft.description} onChangeText={description => onChange({ ...draft, description })} placeholder="What will volunteers do?" multiline maxLength={500} />
      <Field label="Requirements" value={draft.requirements} onChangeText={requirements => onChange({ ...draft, requirements })} placeholder="Optional — e.g. background check, 16+" maxLength={300} />
      <AppText variant="overline" tone="muted">
        Shifts
      </AppText>
      {errors.shifts ? (
        <AppText variant="caption" tone="danger">
          {errors.shifts}
        </AppText>
      ) : null}
      {draft.shifts.map((sh, i) => (
        <Card key={sh.key} variant="outline" style={{ gap: t.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="overline" tone="gold">
              Shift {i + 1}
            </AppText>
            {draft.shifts.length > 1 ? (
              <IconButton icon="trash-outline" label={`Remove shift ${i + 1}`} size={32} tone="plain" color={t.c.danger} onPress={() => onChange({ ...draft, shifts: draft.shifts.filter(x => x.key !== sh.key) })} />
            ) : null}
          </View>
          <DateTimeField
            label="Starts"
            value={sh.start}
            suggested={() => defaultStart ?? new Date(Date.now() + 86_400_000)}
            onChange={start => setShift(sh.key, { start, end: sh.end && sh.end > start ? sh.end : new Date(start.getTime() + 2 * 3_600_000) })}
            error={errors[`start_${sh.key}`]}
          />
          <DateTimeField
            label="Ends"
            value={sh.end}
            minimumDate={sh.start ?? undefined}
            suggested={() => (sh.start ? new Date(sh.start.getTime() + 2 * 3_600_000) : defaultEnd ?? new Date(Date.now() + 86_400_000 + 7_200_000))}
            onChange={end => setShift(sh.key, { end })}
            error={errors[`end_${sh.key}`]}
          />
          <Field
            label="Volunteers needed"
            value={sh.spots}
            onChangeText={v => setShift(sh.key, { spots: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            maxLength={3}
            containerStyle={{ width: 160 }}
            error={errors[`spots_${sh.key}`]}
          />
        </Card>
      ))}
      <Button
        title="Add shift"
        icon="add"
        variant="secondary"
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => {
          const last = draft.shifts[draft.shifts.length - 1];
          const start = last?.end ?? defaultStart ?? null;
          onChange({ ...draft, shifts: [...draft.shifts, newShift(start, start ? new Date(start.getTime() + 2 * 3_600_000) : null)] });
        }}
      />
    </View>
  );
}

const useStyles = makeStyles(t => ({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: t.c.surface3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: t.c.border },
}));
