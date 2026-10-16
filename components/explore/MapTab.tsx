import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapStyleElement, type Region } from 'react-native-maps';
import { useTheme } from '../../contexts/ThemeContext';
import { useFriendsGoing } from '../../hooks/useFriendsGoing';
import { getEvents } from '../../lib/api';
import { clusterPoints, regionForPoints, type GeoPoint } from '../../lib/clusters';
import { mapStyles, shadow } from '../../lib/theme';
import type { Event } from '../../lib/types';
import { EventCard } from '../EventCard';
import { AppText, Glass, IconButton, PinCross } from '../ui';
import { silentLocation, useUserLocation } from './useUserLocation';

const US_CENTER: Region = { latitude: 39.5, longitude: -98.35, latitudeDelta: 28, longitudeDelta: 28 };
const USER_DELTA = 0.5;

interface EventPoint extends GeoPoint {
  event: Event;
}

function ClusterBubble({ count }: { count: number }) {
  const t = useTheme();
  const size = Math.min(58, 36 + Math.round(Math.log2(count) * 4));
  return (
    <View
      style={[
        styles.cluster,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.gold, borderColor: t.c.bg },
        shadow(2, t.c.shadow),
      ]}
    >
      <AppText variant="bodyStrong" color={t.c.onGold}>
        {count > 99 ? '99+' : count}
      </AppText>
    </View>
  );
}

export function MapTab({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  const mapRef = useRef<MapView>(null);
  const location = useUserLocation('Turn on location to center the map on gatherings around you.');
  const [events, setEvents] = useState<Event[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [region, setRegion] = useState<Region>(US_CENTER);
  const [selected, setSelected] = useState<Event | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const positioned = useRef(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await getEvents({ limit: 200 });
      setEvents(res.events);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const points = useMemo<EventPoint[]>(
    () =>
      (events ?? [])
        .filter(e => typeof e.lat === 'number' && typeof e.lng === 'number' && Number.isFinite(e.lat) && Number.isFinite(e.lng))
        .map(e => ({ id: e.id, lat: e.lat as number, lng: e.lng as number, event: e })),
    [events],
  );

  const move = useCallback(
    (r: Region) => {
      mapRef.current?.animateToRegion(r, t.reduceMotion ? 0 : 400);
    },
    [t.reduceMotion],
  );

  useEffect(() => {
    if (events === null || positioned.current) return;
    positioned.current = true;
    silentLocation().then(c => {
      if (c) {
        setHasLocation(true);
        move({ latitude: c.lat, longitude: c.lng, latitudeDelta: USER_DELTA, longitudeDelta: USER_DELTA });
      } else {
        move(regionForPoints(points, US_CENTER));
      }
    });
  }, [events, points, move]);

  const clusters = useMemo(() => clusterPoints(points, region), [points, region]);
  const friends = useFriendsGoing(useMemo(() => (selected ? [selected.id] : []), [selected]));

  const locateMe = async () => {
    const c = await location.request();
    if (!c) return;
    setHasLocation(true);
    move({ latitude: c.lat, longitude: c.lng, latitudeDelta: USER_DELTA, longitudeDelta: USER_DELTA });
  };

  const status =
    events === null && !failed
      ? 'Finding events…'
      : failed
        ? 'Couldn’t load events. Tap to retry.'
        : points.length === 0
          ? 'No events with a map location yet'
          : null;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={mapStyles[t.scheme] as MapStyleElement[]}
        userInterfaceStyle={t.scheme}
        initialRegion={US_CENTER}
        onRegionChangeComplete={setRegion}
        showsUserLocation={hasLocation}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        onPress={e => {
          if (e.nativeEvent.action !== 'marker-press') setSelected(null);
        }}
        accessibilityLabel="Map of events"
      >
        {clusters.map(c =>
          c.items.length === 1 ? (
            <Marker
              key={c.id}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
              title={Platform.OS === 'android' ? undefined : c.items[0].event.name}
              accessibilityLabel={c.items[0].event.name}
              onPress={() => setSelected(c.items[0].event)}
            >
              <PinCross size={34} />
            </Marker>
          ) : (
            <Marker
              key={`${c.id}:${c.items.length}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
              accessibilityLabel={`${c.items.length} events. Tap to zoom in.`}
              onPress={() => {
                setSelected(null);
                move({
                  latitude: c.lat,
                  longitude: c.lng,
                  latitudeDelta: Math.max(region.latitudeDelta / 3, 0.01),
                  longitudeDelta: Math.max(region.longitudeDelta / 3, 0.01),
                });
              }}
            >
              <ClusterBubble count={c.items.length} />
            </Marker>
          ),
        )}
      </MapView>

      <View style={styles.topBar} pointerEvents="box-none">
        {status ? (
          <Pressable
            onPress={failed ? load : undefined}
            disabled={!failed}
            accessibilityRole={failed ? 'button' : 'text'}
            accessibilityLabel={status}
            accessibilityLiveRegion="polite"
          >
            <Glass style={[styles.pill, { borderColor: t.c.border, borderRadius: t.radius.pill }]}>
              <AppText variant="caption" tone={failed ? 'danger' : 'default'}>
                {status}
              </AppText>
            </Glass>
          </Pressable>
        ) : (
          <View />
        )}
        <IconButton icon="locate" label="Center on my location" onPress={locateMe} size={44} style={shadow(2, t.c.shadow)} />
      </View>

      {selected ? (
        <View style={[styles.preview, { bottom: bottomInset }]}>
          <View style={styles.previewClose}>
            <IconButton icon="close" label="Close preview" size={32} onPress={() => setSelected(null)} style={shadow(1, t.c.shadow)} />
          </View>
          <View style={[shadow(3, t.c.shadow), { borderRadius: t.radius.lg }]}>
            <EventCard event={selected} variant="row" friends={friends[selected.id]} />
          </View>
        </View>
      ) : null}
      {location.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  topBar: { position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  preview: { position: 'absolute', left: 16, right: 16, gap: 8 },
  previewClose: { alignItems: 'flex-end' },
});
