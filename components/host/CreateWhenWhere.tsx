import React from 'react';
import { View } from 'react-native';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { EVENT_FORMATS } from '../../lib/constants';
import { REPEAT_CHOICES, REPEAT_CHOICE_LABELS, repeatSentence, type RepeatChoice } from '../../lib/eventRepeat';
import type { Event } from '../../lib/types';
import { AppText, Field, ListRow } from '../ui';
import { ChipWrap, Label } from './CreateBasics';
import { DateTimeField, nextRoundHour } from './DateTimeField';
import type { StepProps } from './eventDraft';

const FORMAT_LABELS = { in_person: 'In person', online: 'Online', hybrid: 'Hybrid' } as const;

/**
 * `existing` is the event being edited: once a repeating event's first date is published, its rule can't change here
 * (later dates are edited with "This and later dates" on save, and ended from the event page).
 */
export function CreateWhenWhere({ draft, update, errors, editing, existing }: StepProps & { existing?: Event | null }) {
  const t = useTheme();
  const s = useStyles();
  const now = new Date();
  const repeatLocked = !!existing && !(existing.status === 'draft' && (existing.series_index ?? 0) === 0);
  const repeating = draft.repeat !== 'none';
  const showPlace = draft.format === 'in_person' || draft.format === 'hybrid';
  const showOnline = draft.format === 'online' || draft.format === 'hybrid';

  return (
    <View style={{ gap: t.space.lg }}>
      <DateTimeField
        label="Starts"
        value={draft.start}
        minimumDate={editing ? undefined : now}
        suggested={() => nextRoundHour(24 * 7)}
        onChange={start => {
          const keepLength = draft.start && draft.end ? draft.end.getTime() - draft.start.getTime() : 2 * 3_600_000;
          const end = !draft.end || draft.end.getTime() <= start.getTime() ? new Date(start.getTime() + Math.max(keepLength, 30 * 60_000)) : draft.end;
          update({ start, end });
        }}
        error={errors.start_date}
      />
      <DateTimeField
        label="Ends"
        value={draft.end}
        minimumDate={draft.start ?? now}
        suggested={() => new Date((draft.start ?? nextRoundHour(24 * 7)).getTime() + 2 * 3_600_000)}
        onChange={end => update({ end })}
        error={errors.end_date}
        hint="Optional. Defaults to two hours after the start."
      />

      {repeatLocked ? (
        existing?.series_id && draft.repeat !== 'none' ? (
          <View style={{ gap: 4 }}>
            <Label>Repeats</Label>
            <AppText variant="body">{draft.start ? repeatSentence(draft.repeat, draft.start) : REPEAT_CHOICE_LABELS[draft.repeat]}</AppText>
            <AppText variant="caption" tone="faint">
              When you save, you can apply changes to this date only or to this and later dates. To stop it, open the event and choose
              “Cancel this and later dates”.
            </AppText>
          </View>
        ) : null
      ) : (
        <View style={{ gap: t.space.sm }}>
          <Label>Repeats</Label>
          <ChipWrap
            options={REPEAT_CHOICES}
            value={draft.repeat}
            labels={REPEAT_CHOICE_LABELS}
            onChange={repeat => update(repeat === 'none' ? { repeat } : { repeat, is_paid: false })}
          />
          {repeating ? (
            <>
              <AppText variant="callout" tone="muted">
                {draft.start ? `${repeatSentence(draft.repeat as Exclude<RepeatChoice, 'none'>, draft.start)}. ` : ''}
                Each date gets its own RSVPs and reminders. Repeating events are free to attend.
              </AppText>
              <View>
                <Label>Ends</Label>
                <ChipWrap
                  options={['never', 'on'] as const}
                  value={draft.repeat_until ? 'on' : 'never'}
                  labels={{ never: 'No end date', on: 'On a date' }}
                  onChange={v =>
                    update({
                      repeat_until:
                        v === 'never' ? null : draft.repeat_until ?? new Date((draft.start ?? now).getTime() + 90 * 86_400_000),
                    })
                  }
                />
              </View>
              {draft.repeat_until ? (
                <DateTimeField
                  label="Last date"
                  mode="date"
                  value={draft.repeat_until}
                  minimumDate={draft.start ?? now}
                  onChange={repeat_until => update({ repeat_until })}
                  error={errors.repeat_until}
                  hint="It can run for up to a year."
                />
              ) : (
                <AppText variant="caption" tone="faint">
                  New dates keep appearing three months ahead, for up to a year. You can stop it any time.
                </AppText>
              )}
            </>
          ) : null}
        </View>
      )}

      <View>
        <Label>Format</Label>
        <ChipWrap options={EVENT_FORMATS} value={draft.format} onChange={format => update({ format })} labels={FORMAT_LABELS} />
      </View>

      {showPlace ? (
        <View style={{ gap: t.space.md }}>
          <Field label="Venue" value={draft.venue_name} onChangeText={venue_name => update({ venue_name })} placeholder="Grace Fellowship Hall" error={errors.venue_name} />
          <Field label="Street address" value={draft.address} onChangeText={address => update({ address })} placeholder="123 Main St" autoComplete="street-address" error={errors.address} />
          <View style={s.row}>
            <Field label="City" value={draft.city} onChangeText={city => update({ city })} containerStyle={{ flex: 2 }} error={errors.city} autoComplete="postal-address-locality" />
            <Field label="State" value={draft.state} onChangeText={state => update({ state })} containerStyle={{ flex: 1 }} maxLength={50} autoCapitalize="characters" error={errors.state} />
          </View>
          <Field label="ZIP" value={draft.zip} onChangeText={zip => update({ zip })} keyboardType="number-pad" maxLength={10} containerStyle={{ width: 140 }} error={errors.zip} />
        </View>
      ) : null}

      {showOnline ? (
        <Field
          label="Online link"
          value={draft.online_url}
          onChangeText={online_url => update({ online_url })}
          placeholder="https://"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.online_url}
          hint="Shared with guests who RSVP or buy a ticket."
        />
      ) : null}

      <Field
        label="Max capacity"
        value={draft.max_capacity}
        onChangeText={max_capacity => update({ max_capacity: max_capacity.replace(/[^0-9]/g, '') })}
        placeholder="Unlimited"
        keyboardType="number-pad"
        maxLength={6}
        error={errors.max_capacity}
        containerStyle={{ width: 180 }}
      />

      <View style={{ gap: t.space.sm }}>
        <View style={s.group}>
          <ListRow
            icon="time-outline"
            title="Schedule publish"
            subtitle="Publish automatically at a set time"
            toggle={draft.schedule}
            onToggle={schedule => update({ schedule, publish_at: schedule ? draft.publish_at ?? nextRoundHour(1) : draft.publish_at })}
            last
          />
        </View>
        {draft.schedule ? (
          <DateTimeField label="Publish on" value={draft.publish_at} minimumDate={now} onChange={publish_at => update({ publish_at })} error={errors.publish_at} />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', gap: t.space.sm },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
