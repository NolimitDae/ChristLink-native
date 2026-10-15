import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { WEEKDAYS } from '../../lib/recurrence';
import type { Church } from '../../lib/types';
import { AppText, Button, Chip, Field, IconButton } from '../ui';
import { TimeField } from './TimeField';

export interface ChurchFormValues {
  name: string;
  denomination: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  about: string;
  website_url: string;
  livestream_url: string;
  service_times: { day: number; time: string; label?: string }[];
  leaders: { name: string; title?: string }[];
}

export function valuesFromChurch(c?: Partial<Church> | null): ChurchFormValues {
  return {
    name: c?.name ?? '',
    denomination: c?.denomination ?? '',
    address: c?.address ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    zip: c?.zip ?? '',
    about: c?.about ?? '',
    website_url: c?.website_url ?? '',
    livestream_url: c?.livestream_url ?? '',
    service_times: c?.service_times ?? [],
    leaders: c?.leaders ?? [],
  };
}

function cleanUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function toChurchPatch(v: ChurchFormValues): Partial<Church> & { name: string } {
  const opt = (s: string) => s.trim() || null;
  return {
    name: v.name.trim(),
    denomination: opt(v.denomination),
    address: opt(v.address),
    city: opt(v.city),
    state: opt(v.state),
    zip: opt(v.zip),
    about: opt(v.about),
    website_url: cleanUrl(v.website_url),
    livestream_url: cleanUrl(v.livestream_url),
    service_times: v.service_times.map(s => ({ day: s.day, time: s.time, ...(s.label?.trim() ? { label: s.label.trim() } : {}) })),
    leaders: v.leaders.filter(l => l.name.trim()).map(l => ({ name: l.name.trim(), ...(l.title?.trim() ? { title: l.title.trim() } : {}) })),
  };
}

function ServiceTimesEditor({ value, onChange }: { value: ChurchFormValues['service_times']; onChange: (v: ChurchFormValues['service_times']) => void }) {
  const t = useTheme();
  const update = (i: number, patch: Partial<ChurchFormValues['service_times'][number]>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <View style={{ gap: t.space.sm }}>
      {value.map((s, i) => (
        <View key={i} style={[styles.block, { backgroundColor: t.c.surface2, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
          <View style={styles.blockHead}>
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              Service {i + 1}
            </AppText>
            <IconButton icon="trash-outline" label={`Remove service ${i + 1}`} size={34} tone="plain" color={t.c.danger} onPress={() => onChange(value.filter((_, j) => j !== i))} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {WEEKDAYS.map((d, di) => (
              <Chip key={d} label={d.slice(0, 3)} selected={s.day === di} onPress={() => update(i, { day: di })} />
            ))}
          </ScrollView>
          <View style={styles.inline}>
            <TimeField label="Service time" value={s.time} onChange={time => update(i, { time })} />
            <Field
              value={s.label ?? ''}
              onChangeText={label => update(i, { label })}
              placeholder="Label (e.g. Traditional)"
              accessibilityLabel={`Service ${i + 1} label`}
              containerStyle={{ flex: 1 }}
            />
          </View>
        </View>
      ))}
      <Button
        title="Add a service time"
        icon="add"
        variant="secondary"
        size="sm"
        onPress={() => onChange([...value, { day: 0, time: '10:00' }])}
        style={{ alignSelf: 'flex-start' }}
      />
    </View>
  );
}

function LeadersEditor({ value, onChange }: { value: ChurchFormValues['leaders']; onChange: (v: ChurchFormValues['leaders']) => void }) {
  const t = useTheme();
  const update = (i: number, patch: Partial<ChurchFormValues['leaders'][number]>) =>
    onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <View style={{ gap: t.space.sm }}>
      {value.map((l, i) => (
        <View key={i} style={styles.inline}>
          <Field value={l.name} onChangeText={name => update(i, { name })} placeholder="Name" accessibilityLabel={`Leader ${i + 1} name`} containerStyle={{ flex: 1 }} />
          <Field value={l.title ?? ''} onChangeText={title => update(i, { title })} placeholder="Title" accessibilityLabel={`Leader ${i + 1} title`} containerStyle={{ flex: 1 }} />
          <IconButton icon="close" label={`Remove leader ${i + 1}`} size={34} tone="plain" onPress={() => onChange(value.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button title="Add a leader" icon="add" variant="secondary" size="sm" onPress={() => onChange([...value, { name: '' }])} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.sm }}>
      <AppText variant="overline" tone="gold">
        {title}
      </AppText>
      {children}
    </View>
  );
}

interface ChurchFormProps {
  initial?: Partial<Church> | null;
  submitLabel: string;
  onSubmit: (values: ChurchFormValues) => Promise<void>;
}

export function ChurchForm({ initial, submitLabel, onSubmit }: ChurchFormProps) {
  const t = useTheme();
  const [v, setV] = useState<ChurchFormValues>(() => valuesFromChurch(initial));
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const set = <K extends keyof ChurchFormValues>(k: K) => (val: ChurchFormValues[K]) => setV(prev => ({ ...prev, [k]: val }));

  const submit = async () => {
    if (v.name.trim().length < 2) {
      setNameError('Please enter the church’s name');
      return;
    }
    setNameError(null);
    setBusy(true);
    try {
      await onSubmit(v);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: t.space.lg }}>
      <Group title="Basics">
        <Field label="Church name" value={v.name} onChangeText={set('name')} error={nameError} placeholder="Grace Community Church" />
        <Field label="Denomination" value={v.denomination} onChangeText={set('denomination')} placeholder="Non-denominational" />
        <Field label="About" value={v.about} onChangeText={set('about')} multiline placeholder="Who you are, what to expect on a Sunday…" />
      </Group>
      <Group title="Location">
        <Field label="Street address" value={v.address} onChangeText={set('address')} textContentType="streetAddressLine1" />
        <View style={styles.inline}>
          <Field label="City" value={v.city} onChangeText={set('city')} containerStyle={{ flex: 2 }} textContentType="addressCity" />
          <Field label="State" value={v.state} onChangeText={set('state')} containerStyle={{ flex: 1 }} autoCapitalize="characters" maxLength={2} />
          <Field label="ZIP" value={v.zip} onChangeText={set('zip')} containerStyle={{ flex: 1.2 }} keyboardType="number-pad" maxLength={10} />
        </View>
      </Group>
      <Group title="Links">
        <Field label="Website" value={v.website_url} onChangeText={set('website_url')} autoCapitalize="none" keyboardType="url" placeholder="yourchurch.org" />
        <Field label="Livestream" value={v.livestream_url} onChangeText={set('livestream_url')} autoCapitalize="none" keyboardType="url" placeholder="youtube.com/@yourchurch/live" />
      </Group>
      <Group title="Service times">
        <ServiceTimesEditor value={v.service_times} onChange={set('service_times')} />
      </Group>
      <Group title="Leaders">
        <LeadersEditor value={v.leaders} onChange={set('leaders')} />
      </Group>
      <Button title={submitLabel} onPress={submit} loading={busy} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { padding: 12, gap: 10, borderWidth: 1 },
  blockHead: { flexDirection: 'row', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
});
