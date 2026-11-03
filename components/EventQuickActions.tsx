import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { addToCalendar } from '../lib/calendar';
import { eventShareUrl, locationLabel } from '../lib/eventHelpers';
import { formatDateShort, formatTime } from '../lib/format';
import { haptic } from '../lib/haptics';
import { openInMaps } from '../lib/maps';
import type { Event } from '../lib/types';
import { BottomSheet } from './ui/BottomSheet';
import { ListRow } from './ui/ListRow';

/**
 * Long-press quick actions for event cards (the iOS context-menu pattern): Save, Share, Add to calendar, Directions,
 * Open. One sheet for the whole app, mounted once in the root layout, so cards stay cheap in long lists.
 */
type Listener = (event: Event) => void;
let listener: Listener | null = null;

export function openEventActions(event: Event) {
  if (!listener) return;
  // The "something appeared" tap that accompanies a context menu
  haptic.medium();
  listener(event);
}

export function EventQuickActionsHost() {
  const t = useTheme();
  const router = useRouter();
  const { savedIds, toggleSaved } = useAppData();
  const { showToast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    listener = setEvent;
    return () => {
      if (listener === setEvent) listener = null;
    };
  }, []);

  const close = () => setEvent(null);
  const e = event;
  const saved = e ? savedIds.has(e.id) : false;
  const place = e ? [e.venue_name, e.address, e.city, e.state].filter(Boolean).join(', ') : '';
  const inPerson = !!e && e.format !== 'online' && (!!place || (typeof e.lat === 'number' && typeof e.lng === 'number'));
  const when = e ? [formatDateShort(e.start_date), formatTime(e.start_date)].filter(Boolean).join(' · ') : '';

  // Close first, then act: the sheet's exit and a share sheet or navigation shouldn't overlap
  const run = (fn: (ev: Event) => void | Promise<void>) => () => {
    if (!e) return;
    close();
    setTimeout(() => void fn(e), 220);
  };

  return (
    <BottomSheet visible={!!e} onClose={close} title={e?.name} subtitle={e ? `${when}${when ? ' · ' : ''}${locationLabel(e)}` : undefined}>
      {e ? (
        <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
          <ListRow
            icon={saved ? 'heart' : 'heart-outline'}
            title={saved ? 'Remove from saved' : 'Save'}
            onPress={() => {
              toggleSaved(e.id);
              if (!saved) haptic.success();
              close();
            }}
          />
          <ListRow
            icon="share-outline"
            title="Share"
            onPress={run(async ev => {
              const url = eventShareUrl(ev.id);
              try {
                await Share.share({ message: `${ev.name} — ${url}`, url, title: ev.name });
              } catch {
                showToast('Could not share', 'error');
              }
            })}
          />
          {e.start_date ? (
            <ListRow
              icon="calendar-outline"
              title="Add to calendar"
              onPress={run(async ev => {
                try {
                  const result = await addToCalendar({
                    title: ev.name,
                    start: ev.start_date as string,
                    end: ev.end_date,
                    location: ev.format === 'online' ? ev.online_url : place,
                    notes: ev.description,
                    url: eventShareUrl(ev.id),
                  });
                  if (result === 'saved') {
                    haptic.success();
                    showToast('Added to your calendar', 'success');
                  }
                } catch {
                  showToast('Could not open your calendar', 'error');
                }
              })}
            />
          ) : null}
          {inPerson ? (
            <ListRow
              icon="navigate-outline"
              title="Directions"
              onPress={run(ev =>
                openInMaps(
                  { parts: [ev.venue_name, ev.address, ev.city, ev.state, ev.zip], lat: ev.lat, lng: ev.lng },
                  { directions: true },
                ).catch(() => showToast('Could not open maps', 'error')),
              )}
            />
          ) : null}
          <ListRow icon="open-outline" title="Open event" onPress={run(ev => router.push(`/event/${ev.id}`))} last />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, paddingHorizontal: 14 },
});
