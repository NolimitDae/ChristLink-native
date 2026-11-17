import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ApiError, createRepost, getEvent, previewRepostLink, removeRepost, updateRepost, uploadRepostFlyer } from '../../lib/api';
import { EVENT_TYPES } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { applyPreview, draftFromRepost, emptyRepostDraft, repostPayload, tidyLink, validateRepost, type RepostDraft, type RepostErrors } from '../../lib/repost';
import { AppText, Button, Card, Chip, EmptyState, Field, Screen, Segmented, Skeleton, SkeletonGroup } from '../../components/ui';
import { DateTimeField } from '../../components/host/DateTimeField';
import { PickError, pickImage } from '../../components/host/pickImage';
import { errorMessage } from '../../components/host/errors';
import { confirmAction } from '../../components/admin/confirm';

const TYPES = EVENT_TYPES.filter(x => x !== 'All');
const FORMATS: { value: RepostDraft['format']; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Both' },
];

/**
 * "Share an event": a member posts an event that's listed on another platform (Eventbrite, a church site, a flyer)
 * so others can find it. Paste the listing link to fill the form, add a flyer, or type the details. It goes live as a
 * repost with a link to the original. `?id=` edits one you shared.
 */
export default function RepostScreen() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;
  const editing = !!id;

  const [draft, setDraft] = useState<RepostDraft>(emptyRepostDraft);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'link' | 'photo' | 'save' | 'remove' | null>(null);
  const [linkNote, setLinkNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const set = useCallback((patch: Partial<RepostDraft>) => setDraft(prev => ({ ...prev, ...patch })), []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ev = await getEvent(id, token);
      if (!ev.is_repost) {
        router.replace(`/event/create?id=${id}`);
        return;
      }
      if (user && ev.host_id !== user.id) throw new Error('Only the person who shared this event can edit it.');
      setDraft(draftFromRepost(ev));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not open this event.'));
    } finally {
      setLoading(false);
    }
  }, [id, token, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const errors: RepostErrors = useMemo(() => validateRepost(draft, { editing }), [draft, editing]);
  const err = (k: keyof RepostErrors) => (showErrors ? errors[k] : undefined);

  const fetchLink = async () => {
    const link = tidyLink(draft.link);
    if (!token || !link) {
      setLinkNote({ ok: false, text: 'Paste the link to the event’s page.' });
      return;
    }
    setBusy('link');
    setLinkNote(null);
    try {
      const preview = await previewRepostLink(link, token);
      setDraft(prev => applyPreview(prev, preview));
      haptic.success();
      setLinkNote({ ok: true, text: preview.start_date ? 'Details filled in. Check them before sharing.' : 'We found some details. Add the date and anything missing.' });
    } catch (e) {
      // The page couldn't be read (some sites block it): keep the link and let them type the rest
      set({ source_url: draft.source_url || link, ticket_url: draft.ticket_url || link });
      setLinkNote({ ok: false, text: errorMessage(e, 'We couldn’t read that page. Fill in the details below instead.') });
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = async () => {
    if (!token) return;
    setBusy('photo');
    try {
      const img = await pickImage({ quality: 0.8 });
      if (!img) return;
      // The server keeps the picture and, when flyer reading is set up, reads the details off it
      const { preview, read } = await uploadRepostFlyer(img.dataUrl, token);
      setDraft(prev => applyPreview(prev, preview));
      if (read) {
        haptic.success();
        setPhotoNote('We read the flyer and filled in what we could. Check the details before sharing.');
      } else setPhotoNote(null);
    } catch (e) {
      showToast(e instanceof PickError ? e.message : errorMessage(e, 'Could not add that photo'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!token) return;
    setShowErrors(true);
    if (Object.keys(errors).length) {
      haptic.error();
      showToast(Object.values(errors)[0] as string, 'error');
      return;
    }
    setBusy('save');
    try {
      const body = repostPayload(draft);
      const ev = editing && id ? await updateRepost(id, body, token) : await createRepost(body, token);
      haptic.success();
      showToast(editing ? 'Changes saved' : 'Shared. Thanks for spreading the word.', 'success');
      router.replace(`/event/${ev.id}`);
    } catch (e) {
      const existingId = e instanceof ApiError ? (e.body?.existingId as string | undefined) : undefined;
      if (existingId) {
        showToast('Someone already shared this event. Here it is.', 'success');
        router.replace(`/event/${existingId}`);
        return;
      }
      haptic.error();
      showToast(errorMessage(e, 'Could not share this event'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!token || !id) return;
    if (!(await confirmAction('Take this down?', 'The page, its “I’m going” list and its discussion are removed. The organizer’s own listing isn’t affected.', 'Take down'))) return;
    setBusy('remove');
    try {
      await removeRepost(id, token);
      showToast('Taken down', 'success');
      router.replace('/(tabs)');
    } catch (e) {
      showToast(errorMessage(e, 'Could not take it down'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const title = editing ? 'Edit shared event' : 'Share an event';

  if (!session) {
    return (
      <Screen title={title} back>
        <EmptyState
          art="calendar"
          title="Know about an event?"
          body="Sign in to share events from other sites so more people can find them."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen title={title} back>
        <SkeletonGroup>
          <View style={{ padding: t.space.md, gap: t.space.md }}>
            <Skeleton height={150} radius={t.radius.lg} />
            <Skeleton height={50} radius={t.radius.md} />
            <Skeleton height={50} radius={t.radius.md} />
          </View>
        </SkeletonGroup>
      </Screen>
    );
  }
  if (loadError) {
    return (
      <Screen title={title} back>
        <EmptyState art="calendar" title="Couldn’t open this event" body={loadError} actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const inPerson = draft.format !== 'online';
  const online = draft.format !== 'in_person';

  return (
    <Screen title={title} back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.lg }}
        >
          {!editing ? (
            <AppText variant="callout" tone="muted">
              Found an event on another site that people here would love? Share it. It’s marked as a repost and links back to the organizer’s page, where
              tickets and official RSVPs stay.
            </AppText>
          ) : null}

          {!editing ? (
            <Card style={{ gap: t.space.sm }}>
              <AppText variant="headline">Start with the link</AppText>
              <AppText variant="callout" tone="muted">
                Paste the event’s page (Eventbrite, a church website, a ticket site) and we’ll fill in what we can.
              </AppText>
              <Field
                placeholder="https://"
                value={draft.link}
                onChangeText={link => set({ link })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Event link"
                onSubmitEditing={fetchLink}
                returnKeyType="go"
              />
              <Button title="Get details" variant="secondary" onPress={fetchLink} loading={busy === 'link'} disabled={busy !== null || !draft.link.trim()} />
              {linkNote ? (
                <AppText variant="caption" tone={linkNote.ok ? 'success' : 'muted'} accessibilityLiveRegion="polite">
                  {linkNote.text}
                </AppText>
              ) : null}
            </Card>
          ) : null}

          <View style={{ gap: t.space.sm }}>
            <AppText variant="label" tone="muted">
              Flyer or photo
            </AppText>
            {draft.cover_url ? (
              <Image source={{ uri: draft.cover_url }} style={s.cover} resizeMode="cover" accessibilityLabel="Event flyer" accessibilityIgnoresInvertColors />
            ) : null}
            <View style={{ flexDirection: 'row', gap: t.space.sm, flexWrap: 'wrap' }}>
              <Button
                title={draft.cover_url ? 'Change photo' : 'Add a flyer or photo'}
                variant="secondary"
                icon="image-outline"
                onPress={addPhoto}
                loading={busy === 'photo'}
                disabled={busy !== null}
              />
              {draft.cover_url ? <Button title="Remove" variant="ghost" onPress={() => set({ cover_url: '' })} disabled={busy !== null} /> : null}
            </View>
            {photoNote ? (
              <AppText variant="caption" tone="success" accessibilityLiveRegion="polite">
                {photoNote}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: t.space.md }}>
            <Field label="Event name" value={draft.name} onChangeText={name => set({ name })} maxLength={120} error={err('name')} />
            <Field
              label="Hosted by"
              placeholder="The church, ministry or person running it"
              value={draft.organizer_name}
              onChangeText={organizer_name => set({ organizer_name })}
              maxLength={120}
              error={err('organizer_name')}
            />
            <DateTimeField label="Starts" value={draft.start} onChange={start => set({ start })} error={err('start')} />
            <DateTimeField
              label="Ends (optional)"
              value={draft.end}
              onChange={end => set({ end })}
              minimumDate={draft.start ?? undefined}
              suggested={() => new Date((draft.start ?? new Date()).getTime() + 2 * 3_600_000)}
              error={err('end')}
            />
          </View>

          <View style={{ gap: t.space.md }}>
            <Segmented options={FORMATS} value={draft.format} onChange={format => set({ format })} />
            {inPerson ? (
              <>
                <Field label="Venue" placeholder="Building or place name" value={draft.venue_name} onChangeText={venue_name => set({ venue_name })} maxLength={200} />
                <Field label="Street address" value={draft.address} onChangeText={address => set({ address })} maxLength={300} />
                <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                  <Field label="City" value={draft.city} onChangeText={city => set({ city })} maxLength={100} error={err('city')} containerStyle={{ flex: 2 }} />
                  <Field label="State" value={draft.state} onChangeText={state => set({ state })} maxLength={50} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
                </View>
              </>
            ) : null}
            {online ? (
              <Field
                label="Link to join online (optional)"
                placeholder="https://"
                value={draft.online_url}
                onChangeText={online_url => set({ online_url })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={err('online_url')}
              />
            ) : null}
          </View>

          <View style={{ gap: t.space.sm }}>
            <AppText variant="label" tone="muted">
              Kind of event (optional)
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
              {TYPES.map(type => (
                <Chip key={type} label={type} selected={draft.event_type === type} onPress={() => set({ event_type: draft.event_type === type ? '' : type })} />
              ))}
            </View>
          </View>

          <Field
            label="About the event"
            placeholder="What it is, who it’s for, anything people should know"
            value={draft.description}
            onChangeText={description => set({ description })}
            multiline
            maxLength={2000}
          />

          <View style={{ gap: t.space.md }}>
            <Field
              label="Original listing"
              placeholder="Link to the organizer’s post or page"
              value={draft.source_url}
              onChangeText={source_url => set({ source_url })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={err('source_url')}
            />
            <Field
              label="Tickets or RSVP"
              placeholder="Where people get tickets or sign up"
              hint="Leave empty if it’s the same page, or if no sign-up is needed."
              value={draft.ticket_url}
              onChangeText={ticket_url => set({ ticket_url })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={err('ticket_url')}
            />
          </View>

          <View style={{ gap: t.space.sm }}>
            <Button title={editing ? 'Save changes' : 'Share event'} size="lg" fullWidth onPress={save} loading={busy === 'save'} disabled={busy !== null} />
            {!editing ? (
              <AppText variant="caption" tone="muted" align="center">
                Share only real events open to the public. Reposts follow the community guidelines and can be reported.
              </AppText>
            ) : (
              <Button title="Take this down" variant="ghost" fullWidth onPress={remove} loading={busy === 'remove'} disabled={busy !== null} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: t.radius.lg, backgroundColor: t.c.surface2 },
}));
