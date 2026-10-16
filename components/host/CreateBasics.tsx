import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { uploadEventImage } from '../../lib/api';
import { AGE_GROUPS, EVENT_TYPES } from '../../lib/constants';
import { AppText, Chip, Field, IconButton, ListRow } from '../ui';
import { errorMessage } from './errors';
import type { StepProps } from './eventDraft';
import { pickImage } from './pickImage';

const TYPES = EVENT_TYPES.filter(x => x !== 'All');
const MAX_GALLERY = 6;

export function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ gap: 2, marginBottom: 8 }}>
      <AppText variant="overline" tone="muted">
        {children}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function ChipWrap<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <Chip key={o} label={labels?.[o] ?? o} selected={o === value} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function CreateBasics({ draft, update, errors, token }: StepProps & { token: string }) {
  const t = useTheme();
  const s = useStyles();
  const { showToast } = useToast();
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);

  const addCover = async () => {
    try {
      const img = await pickImage({ aspect: [16, 9], quality: 0.8 });
      if (!img) return;
      setCoverBusy(true);
      const { url } = await uploadEventImage(img.dataUrl, 'cover', token);
      update({ cover_url: url });
    } catch (err) {
      showToast(errorMessage(err, 'Cover upload failed'), 'error');
    } finally {
      setCoverBusy(false);
    }
  };

  const addGallery = async () => {
    try {
      const img = await pickImage({ quality: 0.75 });
      if (!img) return;
      setGalleryBusy(true);
      const { url } = await uploadEventImage(img.dataUrl, 'gallery', token);
      update({ gallery_urls: [...draft.gallery_urls, url].slice(0, MAX_GALLERY) });
    } catch (err) {
      showToast(errorMessage(err, 'Photo upload failed'), 'error');
    } finally {
      setGalleryBusy(false);
    }
  };

  return (
    <View style={{ gap: t.space.lg }}>
      <View>
        <Label>Event type</Label>
        <ChipWrap options={TYPES} value={draft.event_type as (typeof TYPES)[number]} onChange={v => update({ event_type: v })} />
      </View>

      <Field
        label="Event name"
        value={draft.name}
        onChangeText={name => update({ name })}
        placeholder="Friday Night Worship"
        maxLength={120}
        error={errors.name}
        returnKeyType="next"
      />
      <Field
        label="Description"
        value={draft.description}
        onChangeText={description => update({ description })}
        placeholder="What should guests expect? Who is it for?"
        multiline
        maxLength={2000}
        error={errors.description}
        hint={`${draft.description.length}/2000`}
      />

      <View>
        <Label>Age group</Label>
        <ChipWrap options={AGE_GROUPS} value={draft.age_group as (typeof AGE_GROUPS)[number]} onChange={v => update({ age_group: v })} />
      </View>

      <View>
        <Label hint="16:9 works best. Shown on cards and the event page.">Cover photo</Label>
        <Pressable
          onPress={addCover}
          disabled={coverBusy}
          accessibilityRole="button"
          accessibilityLabel={draft.cover_url ? 'Change cover photo' : 'Add cover photo'}
          style={({ pressed }) => [s.cover, { opacity: pressed ? 0.85 : 1 }]}
        >
          {draft.cover_url ? (
            <Image source={{ uri: draft.cover_url }} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={s.coverEmpty}>
              <Ionicons name="image-outline" size={28} color={t.c.goldText} />
              <AppText variant="callout" tone="muted">
                Add cover photo
              </AppText>
            </View>
          )}
          {coverBusy ? (
            <View style={s.busy}>
              <ActivityIndicator color={t.c.gold} accessibilityLabel="Uploading" />
            </View>
          ) : null}
        </Pressable>
        {draft.cover_url ? (
          <Pressable onPress={() => update({ cover_url: null })} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'flex-start', marginTop: 8, minHeight: 32, justifyContent: 'center' }}>
            <AppText variant="caption" tone="danger">
              Remove cover
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View>
        <Label hint={`Up to ${MAX_GALLERY} photos from past gatherings.`}>Gallery</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {draft.gallery_urls.map(url => (
            <View key={url}>
              <Image source={{ uri: url }} style={s.thumb} accessibilityIgnoresInvertColors />
              <IconButton
                icon="close"
                label="Remove photo"
                size={26}
                tone="glass"
                style={s.thumbRemove}
                onPress={() => update({ gallery_urls: draft.gallery_urls.filter(u => u !== url) })}
              />
            </View>
          ))}
          {draft.gallery_urls.length < MAX_GALLERY ? (
            <Pressable onPress={addGallery} disabled={galleryBusy} accessibilityRole="button" accessibilityLabel="Add gallery photo" style={[s.thumb, s.addThumb]}>
              {galleryBusy ? <ActivityIndicator color={t.c.gold} /> : <Ionicons name="add" size={26} color={t.c.goldText} />}
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <View style={s.group}>
        <ListRow
          icon="chatbubbles-outline"
          title="Event forum"
          subtitle="Let guests chat and ask questions before the event"
          toggle={draft.forum_enabled}
          onToggle={forum_enabled => update({ forum_enabled })}
          last
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  cover: { aspectRatio: 16 / 9, borderRadius: t.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.surface },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderStyle: 'dashed', borderWidth: 1.5, borderColor: t.c.goldHairline, borderRadius: t.radius.lg },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.overlay },
  thumb: { width: 84, height: 84, borderRadius: t.radius.md, backgroundColor: t.c.surface2 },
  addThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.c.goldHairline },
  thumbRemove: { position: 'absolute', top: 4, right: 4 },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
