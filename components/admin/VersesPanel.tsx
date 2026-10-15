import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { listVerses, saveVerse, type AdminVerse } from '../../lib/features';
import { AppText, Badge, BottomSheet, Button, Card, Field, ListRow } from '../ui';
import { errorMessage } from '../host/errors';
import { PanelState } from './PanelState';
import { useLoad } from './useLoad';

interface VerseDraft {
  id?: number;
  reference: string;
  text: string;
  themes: string;
  translation: string;
  active: boolean;
}

const blank: VerseDraft = { reference: '', text: '', themes: '', translation: 'WEB', active: true };

export function VersesPanel() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const fn = useCallback(() => listVerses(), []);
  const state = useLoad(fn);
  const [editing, setEditing] = useState<VerseDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ reference?: string; text?: string }>({});

  const open = (v?: AdminVerse) => {
    setErrors({});
    setEditing(v ? { id: v.id, reference: v.reference, text: v.text, themes: v.themes.join(', '), translation: v.translation, active: v.active } : { ...blank });
  };

  const save = async () => {
    if (!editing) return;
    const e: typeof errors = {};
    if (!editing.reference.trim()) e.reference = 'Reference is required';
    if (editing.text.trim().length < 5) e.text = 'Verse text is required';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await saveVerse({
        id: editing.id,
        reference: editing.reference.trim(),
        text: editing.text.trim(),
        translation: editing.translation.trim() || 'WEB',
        themes: editing.themes
          .split(',')
          .map(x => x.trim().toLowerCase())
          .filter(Boolean),
        active: editing.active,
      });
      showToast(editing.id ? 'Verse updated' : 'Verse added', 'success');
      setEditing(null);
      await state.reload();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.sm }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <Button title="Add verse" icon="add" onPress={() => open()} style={{ alignSelf: 'flex-start' }} />
        <PanelState state={state} art="cross" emptyTitle="No verses yet" emptyBody="Verses rotate on the Home screen as the verse of the day." isEmpty={d => d.length === 0} />
        {(state.data ?? []).map(v => (
          <Card key={v.id} onPress={() => open(v)} accessibilityLabel={`Edit ${v.reference}`} style={[{ gap: 6 }, !v.active ? { opacity: 0.6 } : null]}>
            <View style={s.row}>
              <AppText variant="headline" tone="gold" style={{ flex: 1 }}>
                {v.reference}
              </AppText>
              <AppText variant="caption" tone="faint">
                {v.translation}
              </AppText>
              {!v.active ? <Badge label="Hidden" /> : null}
            </View>
            <AppText variant="callout" numberOfLines={3}>
              {v.text}
            </AppText>
            {v.themes.length ? (
              <AppText variant="caption" tone="muted">
                {v.themes.join(' · ')}
              </AppText>
            ) : null}
          </Card>
        ))}
      </ScrollView>
      <BottomSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit verse' : 'Add verse'}
        footer={<Button title="Save" fullWidth onPress={save} loading={saving} />}
      >
        {editing ? (
          <View style={{ gap: t.space.md }}>
            <View style={s.row}>
              <Field label="Reference" value={editing.reference} onChangeText={reference => setEditing({ ...editing, reference })} placeholder="John 3:16" containerStyle={{ flex: 2 }} error={errors.reference} />
              <Field label="Translation" value={editing.translation} onChangeText={translation => setEditing({ ...editing, translation })} autoCapitalize="characters" containerStyle={{ flex: 1 }} maxLength={8} />
            </View>
            <Field label="Text" value={editing.text} onChangeText={text => setEditing({ ...editing, text })} multiline error={errors.text} />
            <Field label="Themes" value={editing.themes} onChangeText={themes => setEditing({ ...editing, themes })} placeholder="hope, peace, courage" autoCapitalize="none" hint="Comma-separated" />
            <View style={s.group}>
              <ListRow title="Active" subtitle="Eligible for verse of the day" toggle={editing.active} onToggle={active => setEditing({ ...editing, active })} last />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
