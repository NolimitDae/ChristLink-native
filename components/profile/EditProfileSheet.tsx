import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { updateProfile } from '../../lib/api';
import type { Profile } from '../../lib/types';
import { formatZodErrors, profileUpdateSchema } from '../../lib/validation';
import { BottomSheet, Button, Field } from '../ui';

interface Form {
  full_name: string;
  bio: string;
  city: string;
  instagram_url: string;
  bible_verse: string;
  bible_verse_reference: string;
  prayer_request: string;
}

const PRAYER_MAX = 500;

function fromProfile(p: Profile | null): Form {
  return {
    full_name: p?.full_name ?? '',
    bio: p?.bio ?? '',
    city: p?.city ?? '',
    instagram_url: p?.instagram_url ?? '',
    bible_verse: p?.bible_verse ?? '',
    bible_verse_reference: p?.bible_verse_reference ?? '',
    prayer_request: p?.prayer_request ?? '',
  };
}

/** Accepts "@handle", "handle" or a full URL. */
export function normalizeInstagram(input: string): string {
  const v = input.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '').replace(/^instagram\.com\//i, '')}`;
}

export function EditProfileSheet({
  visible,
  onClose,
  profile,
  token,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  token: string;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTheme();
  const { showToast } = useToast();
  const [form, setForm] = useState<Form>(() => fromProfile(profile));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(fromProfile(profile));
      setError(null);
    }
  }, [visible, profile]);

  const set = (k: keyof Form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    const parsed = profileUpdateSchema.safeParse({
      full_name: form.full_name,
      bio: form.bio,
      city: form.city,
      bible_verse: form.bible_verse,
      bible_verse_reference: form.bible_verse_reference,
      instagram_url: normalizeInstagram(form.instagram_url),
    });
    if (!parsed.success) {
      setError(formatZodErrors(parsed.error));
      return;
    }
    if (form.prayer_request.trim().length > PRAYER_MAX) {
      setError(`Prayer request must be ${PRAYER_MAX} characters or less`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ ...parsed.data, prayer_request: form.prayer_request.trim() }, token);
      await onSaved();
      showToast('Profile updated', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      footer={<Button title="Save" onPress={save} loading={saving} disabled={!form.full_name.trim()} fullWidth />}
    >
      <View style={{ gap: t.space.md }}>
        <Field label="Name" value={form.full_name} onChangeText={set('full_name')} maxLength={80} autoComplete="name" textContentType="name" />
        <Field label="Bio" value={form.bio} onChangeText={set('bio')} multiline maxLength={300} hint={`${form.bio.length}/300`} />
        <Field label="City" value={form.city} onChangeText={set('city')} maxLength={100} textContentType="addressCity" />
        <Field
          label="Instagram"
          value={form.instagram_url}
          onChangeText={set('instagram_url')}
          placeholder="@yourhandle"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field label="Favorite verse" value={form.bible_verse} onChangeText={set('bible_verse')} multiline maxLength={500} placeholder="For I know the plans I have for you…" />
        <Field label="Verse reference" value={form.bible_verse_reference} onChangeText={set('bible_verse_reference')} maxLength={100} placeholder="Jeremiah 29:11" />
        <Field
          label="Pinned prayer request"
          value={form.prayer_request}
          onChangeText={set('prayer_request')}
          multiline
          maxLength={PRAYER_MAX}
          hint="Shown on your profile so friends can pray for you"
          error={error}
        />
      </View>
    </BottomSheet>
  );
}
