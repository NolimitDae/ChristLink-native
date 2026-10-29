import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { updateProfile } from '../../lib/api';
import { haptic } from '../../lib/haptics';
import {
  AVATAR_GRADIENTS,
  BIBLE_VERSIONS,
  CONNECT_OPTIONS,
  DEFAULT_BIBLE_VERSION,
  HOBBIES,
  LIMITS,
  RING_COLORS,
  formatHobbies,
  normalizeSocial,
  parseHobbies,
  toggle,
} from '../../lib/profileOptions';
import type { Profile } from '../../lib/types';
import { formatZodErrors, profileUpdateSchema } from '../../lib/validation';
import { Avatar } from '../Avatar';
import { AppText, BottomSheet, Button, Chip, ChipRow, Field } from '../ui';

interface Form {
  full_name: string;
  bio: string;
  city: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  bible_verse: string;
  bible_verse_reference: string;
  bible_version: string;
  hot_takes: string;
  hobbies: string[];
  connect_tags: string[];
  prayer_request: string;
  testimony: string;
  avatar_color: string | null;
  avatar_ring_color: string | null;
}

function fromProfile(p: Profile | null): Form {
  return {
    full_name: p?.full_name ?? '',
    bio: p?.bio ?? '',
    city: p?.city ?? '',
    instagram_url: p?.instagram_url ?? '',
    facebook_url: p?.facebook_url ?? '',
    tiktok_url: p?.tiktok_url ?? '',
    bible_verse: p?.bible_verse ?? '',
    bible_verse_reference: p?.bible_verse_reference ?? '',
    bible_version: p?.bible_version || DEFAULT_BIBLE_VERSION,
    hot_takes: p?.hot_takes ?? '',
    hobbies: parseHobbies(p?.hobbies),
    connect_tags: p?.connect_tags ?? [],
    prayer_request: p?.prayer_request ?? '',
    testimony: p?.testimony ?? '',
    avatar_color: p?.avatar_color ?? null,
    avatar_ring_color: p?.avatar_ring_color ?? null,
  };
}

/** Accepts "@handle", "handle" or a full URL. */
export function normalizeInstagram(input: string): string {
  return normalizeSocial(input, 'instagram.com');
}

/** Same label style as `Field`, for groups that aren't a single text box. */
function GroupLabel({ children }: { children: string }) {
  return (
    <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
      {children}
    </AppText>
  );
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
  const pick = <K extends keyof Form>(k: K, v: Form[K]) => {
    haptic.tap();
    setForm(f => ({ ...f, [k]: v }));
  };

  const save = async () => {
    const parsed = profileUpdateSchema.safeParse({
      full_name: form.full_name,
      bio: form.bio,
      city: form.city,
      bible_verse: form.bible_verse,
      bible_verse_reference: form.bible_verse_reference,
      instagram_url: normalizeSocial(form.instagram_url, 'instagram.com'),
      facebook_url: normalizeSocial(form.facebook_url, 'facebook.com'),
      tiktok_url: normalizeSocial(form.tiktok_url, 'tiktok.com'),
    });
    if (!parsed.success) {
      setError(formatZodErrors(parsed.error));
      return;
    }
    const tooLong: [string, string, number][] = [
      ['Hot takes', form.hot_takes, LIMITS.hotTakes],
      ['Prayer request', form.prayer_request, LIMITS.prayerRequest],
      ['Testimony', form.testimony, LIMITS.testimony],
    ];
    const over = tooLong.find(([, v, max]) => v.trim().length > max);
    if (over) {
      setError(`${over[0]} must be ${over[2]} characters or less`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile(
        {
          ...parsed.data,
          bible_version: form.bible_version,
          hot_takes: form.hot_takes.trim(),
          hobbies: formatHobbies(form.hobbies),
          connect_tags: form.connect_tags,
          prayer_request: form.prayer_request.trim(),
          testimony: form.testimony.trim(),
          ...(form.avatar_color ? { avatar_color: form.avatar_color } : {}),
          avatar_ring_color: form.avatar_ring_color,
        },
        token,
      );
      await onSaved();
      showToast('Profile updated', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const socialProps = { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'url' } as const;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      footer={<Button title="Save" onPress={save} loading={saving} disabled={!form.full_name.trim()} fullWidth />}
    >
      <View style={{ gap: t.space.md }}>
        <View style={s.group}>
          <GroupLabel>Avatar color</GroupLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatches}>
            {AVATAR_GRADIENTS.map(c => {
              const selected = form.avatar_color === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => pick('avatar_color', c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Avatar color ${AVATAR_GRADIENTS.indexOf(c) + 1}`}
                  style={s.touch}
                >
                  <Avatar name={form.full_name || '?'} color={c} size={40} ringColor={selected ? t.c.gold : null} ringWidth={2.5} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.group}>
          <GroupLabel>Profile ring</GroupLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatches}>
            {RING_COLORS.map(c => {
              const selected = form.avatar_ring_color === c;
              return (
                <Pressable
                  key={c ?? 'none'}
                  onPress={() => pick('avatar_ring_color', c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c ? `Ring color ${c}` : 'No ring'}
                  style={s.touch}
                >
                  <View
                    style={[
                      s.ring,
                      c
                        ? { backgroundColor: c, borderColor: selected ? t.c.text : t.c.border }
                        : { borderColor: selected ? t.c.text : t.c.borderStrong, borderStyle: 'dashed' },
                      selected && { borderWidth: 2.5 },
                    ]}
                  >
                    {c ? null : <Ionicons name="close" size={18} color={t.c.textMuted} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Field label="Name" value={form.full_name} onChangeText={set('full_name')} maxLength={80} autoComplete="name" textContentType="name" />
        <Field label="City" value={form.city} onChangeText={set('city')} maxLength={100} textContentType="addressCity" />
        <Field label="Bio" value={form.bio} onChangeText={set('bio')} multiline maxLength={300} hint={`${form.bio.length}/300`} />

        <Field label="Instagram" value={form.instagram_url} onChangeText={set('instagram_url')} placeholder="instagram.com/yourhandle" {...socialProps} />
        <Field label="Facebook" value={form.facebook_url} onChangeText={set('facebook_url')} placeholder="facebook.com/yourpage" {...socialProps} />
        <Field label="TikTok" value={form.tiktok_url} onChangeText={set('tiktok_url')} placeholder="tiktok.com/@yourhandle" {...socialProps} />

        <Field label="Favorite Bible verse" value={form.bible_verse} onChangeText={set('bible_verse')} multiline maxLength={500} placeholder="For I know the plans I have for you…" />
        <Field label="Verse reference" value={form.bible_verse_reference} onChangeText={set('bible_verse_reference')} maxLength={100} placeholder="Jeremiah 29:11" />
        <View style={s.group}>
          <GroupLabel>Translation</GroupLabel>
          <ChipRow options={BIBLE_VERSIONS} value={form.bible_version as (typeof BIBLE_VERSIONS)[number]} onChange={v => pick('bible_version', v)} style={{ paddingHorizontal: 0 }} />
        </View>

        <Field
          label="Hot takes"
          value={form.hot_takes}
          onChangeText={set('hot_takes')}
          multiline
          maxLength={LIMITS.hotTakes}
          placeholder="Pineapple belongs on pizza…"
          hint={`${form.hot_takes.length}/${LIMITS.hotTakes}`}
        />

        <View style={s.group}>
          <GroupLabel>Hobbies & interests (tap to select)</GroupLabel>
          <View style={s.wrap}>
            {HOBBIES.map(h => (
              <Chip key={h.label} label={h.label} icon={h.icon} selected={form.hobbies.includes(h.label)} onPress={() => pick('hobbies', toggle(form.hobbies, h.label))} />
            ))}
          </View>
        </View>

        <View style={s.group}>
          <GroupLabel>Open to connect</GroupLabel>
          <View style={s.wrap}>
            {CONNECT_OPTIONS.map(o => (
              <Chip key={o.id} label={o.label} icon={o.icon} selected={form.connect_tags.includes(o.id)} onPress={() => pick('connect_tags', toggle(form.connect_tags, o.id))} />
            ))}
          </View>
        </View>

        <Field
          label="Prayer request"
          value={form.prayer_request}
          onChangeText={set('prayer_request')}
          multiline
          maxLength={LIMITS.prayerRequest}
          hint={`Shown on your profile so friends can pray for you · ${form.prayer_request.length}/${LIMITS.prayerRequest}`}
        />
        <Field
          label="Latest testimony"
          value={form.testimony}
          onChangeText={set('testimony')}
          multiline
          maxLength={LIMITS.testimony}
          hint={`${form.testimony.length}/${LIMITS.testimony}`}
          error={error}
        />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  group: { gap: 8 },
  swatches: { gap: 6, paddingRight: 8 },
  // 44pt touch target around each swatch
  touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
