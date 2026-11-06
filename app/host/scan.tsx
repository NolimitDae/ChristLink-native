import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getAttendance, getMyEvents, verifyTicket } from '../../lib/api';
import { serveCheckIn } from '../../lib/features';
import { parseScan } from '../../lib/qr';
import { formatDateShort, formatTime, timeAgo } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { Event } from '../../lib/types';
import { AppText, BottomSheet, Button, EmptyState, Field, IconButton, LineArt, ListRow, Screen, Skeleton } from '../../components/ui';
import { ScanFrame } from '../../components/host/ScanFrame';
import { errorMessage, isNotSetUp } from '../../components/host/errors';

const DEDUPE_MS = 3000;

type Outcome = 'ok' | 'fail' | 'repeat';

interface ScanResult {
  id: string;
  outcome: Outcome;
  title: string;
  detail: string;
  at: number;
}

export default function ScanScreen() {
  const params = useLocalSearchParams<{ eventId?: string; mode?: string }>();
  const serveMode = params.mode === 'serve';
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { session } = useAuth();
  const token = session?.access_token;
  const [permission, requestPermission] = useCameraPermissions();

  const [eventId, setEventId] = useState<string | null>(params.eventId ?? null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(!serveMode && !params.eventId);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<ScanResult[]>([]);
  const [attendance, setAttendance] = useState<{ checked_in: number; total: number } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [banner, setBanner] = useState<Outcome | null>(null);

  const flash = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState(t.c.success);
  const lastScan = useRef<{ data: string; at: number } | null>(null);
  const busy = useRef(false);
  const seen = useRef<Set<string>>(new Set());

  const refreshAttendance = useCallback(async () => {
    if (!eventId || !token || serveMode) return;
    try {
      setAttendance(await getAttendance(eventId, token));
    } catch {
      setAttendance(null);
    }
  }, [eventId, token, serveMode]);

  useEffect(() => {
    refreshAttendance();
  }, [refreshAttendance]);

  useEffect(() => {
    if (serveMode || !token) return;
    if (!pickerOpen && eventName) return;
    getMyEvents(token)
      .then(res => {
        const now = Date.now();
        const list = res.events.filter(e => {
          if (e.status !== 'published') return false;
          const end = e.end_date ? new Date(e.end_date).getTime() : e.start_date ? new Date(e.start_date).getTime() + 6 * 3_600_000 : now;
          return end >= now - 6 * 3_600_000;
        });
        list.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
        setEvents(list);
        if (eventId) setEventName(res.events.find(e => e.id === eventId)?.name ?? null);
      })
      .catch(() => setEvents([]));
  }, [serveMode, token, pickerOpen, eventId, eventName]);

  const signal = (outcome: Outcome) => {
    if (outcome === 'ok') haptic.success();
    else if (outcome === 'fail') haptic.error();
    else haptic.warning();
    if (outcome === 'repeat') return;
    if (t.reduceMotion) {
      setBanner(outcome);
      setTimeout(() => setBanner(null), 1600);
      return;
    }
    setFlashColor(outcome === 'ok' ? t.c.success : t.c.danger);
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.85, duration: 140, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 460, useNativeDriver: true }),
    ]).start();
  };

  const record = (outcome: Outcome, title: string, detail: string) => {
    const r: ScanResult = { id: `${Date.now()}-${Math.random()}`, outcome, title, detail, at: Date.now() };
    setResult(r);
    setRecent(prev => [r, ...prev].slice(0, 5));
    signal(outcome);
  };

  const handleScan = async (raw: string, source: 'camera' | 'manual') => {
    const now = Date.now();
    if (source === 'camera' && lastScan.current && lastScan.current.data === raw && now - lastScan.current.at < DEDUPE_MS) return;
    lastScan.current = { data: raw, at: now };
    if (busy.current) return;

    const payload = parseScan(raw);
    if (payload.kind === 'invalid') {
      record('fail', 'Not a Christ Link code', 'This QR code isn’t a ticket or volunteer pass.');
      return;
    }
    const key = payload.kind === 'ticket' ? payload.data.ticketId : payload.code;
    if (seen.current.has(key)) {
      record('repeat', 'Already scanned', 'This code was checked in earlier on this device.');
      return;
    }
    const asServe = serveMode || payload.kind === 'serve';
    if (!asServe && !eventId) {
      setPickerOpen(true);
      return;
    }

    busy.current = true;
    setProcessing(true);
    try {
      if (asServe) {
        const code = payload.kind === 'ticket' ? payload.data.code : payload.code;
        const r = await serveCheckIn(code);
        if (r.valid) {
          seen.current.add(key);
          record('ok', 'Volunteer checked in', r.message ?? `Pass ${code}`);
        } else {
          record('fail', 'Not checked in', r.error ?? r.message ?? 'This volunteer pass isn’t valid.');
        }
      } else if (eventId && token) {
        if (payload.kind === 'ticket' && payload.data.eventId !== eventId) {
          record('fail', 'Wrong event', 'This ticket is for a different event.');
          return;
        }
        const r = await verifyTicket(
          payload.kind === 'ticket' ? { ticketId: payload.data.ticketId, code: payload.data.code, eventId } : { code: payload.code, eventId },
          token,
        );
        if (r.valid) {
          seen.current.add(key);
          const holder = r.ticket?.profiles?.full_name ?? r.ticket?.ticket_type_name;
          record('ok', 'Valid ticket', [r.message, holder].filter(Boolean).join(' · ') || 'Checked in');
          refreshAttendance();
        } else {
          record('fail', 'Not valid', r.error ?? r.message ?? 'This ticket can’t be checked in.');
        }
      }
    } catch (err) {
      record('fail', isNotSetUp(err) ? 'Serve isn’t ready yet' : 'Check-in failed', errorMessage(err));
    } finally {
      busy.current = false;
      setProcessing(false);
    }
  };

  const onScanned = (res: BarcodeScanningResult) => {
    if (pickerOpen || manualOpen) return;
    handleScan(res.data, 'camera');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/host'));

  if (!session) {
    return (
      <Screen title="Check-in" back>
        <EmptyState art="ticket" title="Sign in to check guests in" actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: t.c.stage }} />;
  }

  if (!permission.granted) {
    return (
      <Screen title="Check-in" back>
        <View style={styles.permWrap}>
          <LineArt name="ticket" size={110} />
          <AppText variant="title2" align="center" style={{ marginTop: t.space.md }}>
            Scan tickets with your camera
          </AppText>
          <AppText variant="callout" tone="muted" align="center" style={{ marginTop: t.space.xs, maxWidth: 320 }}>
            We use the camera only while this screen is open to read QR codes on tickets and volunteer passes. Nothing is recorded or saved.
          </AppText>
          {permission.canAskAgain ? (
            <Button title="Allow camera" icon="camera-outline" size="lg" onPress={requestPermission} style={{ marginTop: t.space.lg }} />
          ) : (
            <>
              <AppText variant="caption" tone="danger" align="center" style={{ marginTop: t.space.md }}>
                Camera access is turned off for Christ Link Social.
              </AppText>
              <Button title="Open Settings" icon="settings-outline" size="lg" onPress={() => Linking.openSettings()} style={{ marginTop: t.space.md }} />
            </>
          )}
          {serveMode || eventId ? <Button title="Enter a code instead" variant="ghost" onPress={() => setManualOpen(true)} style={{ marginTop: t.space.sm }} /> : null}
        </View>
        <ManualSheet
          visible={manualOpen}
          code={manualCode}
          onChange={setManualCode}
          busy={processing}
          onClose={() => setManualOpen(false)}
          onSubmit={() => {
            setManualOpen(false);
            handleScan(manualCode.trim(), 'manual');
            setManualCode('');
          }}
        />
      </Screen>
    );
  }

  const title = serveMode ? 'Volunteer check-in' : eventName ?? (eventId ? 'Ticket check-in' : 'Choose an event');
  const resultColor = result?.outcome === 'ok' ? t.c.success : result?.outcome === 'fail' ? t.c.danger : t.c.gold;

  return (
    <View style={[styles.root, { backgroundColor: t.c.stage }]}>
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={processing ? undefined : onScanned}
        />
      ) : null}
      <ScanFrame offsetY={-60} />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flash }]} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="close" label="Close scanner" tone="glass" onPress={close} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="headline" tone="inverse" numberOfLines={1}>
            {title}
          </AppText>
          {attendance && !serveMode ? (
            <AppText variant="caption" color={t.c.gold} accessibilityLiveRegion="polite">
              Checked in {attendance.checked_in} / {attendance.total}
            </AppText>
          ) : null}
        </View>
        <IconButton icon={torch ? 'flash' : 'flash-outline'} label={torch ? 'Turn torch off' : 'Turn torch on'} tone="glass" color={torch ? t.c.gold : t.c.onImage} onPress={() => setTorch(v => !v)} />
      </View>

      {banner ? (
        <View style={[styles.banner, { top: insets.top + 64, backgroundColor: banner === 'ok' ? t.c.success : t.c.danger }]} accessibilityLiveRegion="assertive">
          <Ionicons name={banner === 'ok' ? 'checkmark-circle' : 'close-circle'} size={20} color={t.c.onStatus} />
          <AppText variant="bodyStrong" color={t.c.onStatus}>
            {banner === 'ok' ? 'Checked in' : 'Not valid'}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {result ? (
          <View style={[styles.card, { backgroundColor: t.c.scrimStrong, borderColor: resultColor }]} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${result.title}. ${result.detail}`}>
            <Ionicons name={result.outcome === 'ok' ? 'checkmark-circle' : result.outcome === 'fail' ? 'close-circle' : 'alert-circle'} size={30} color={resultColor} />
            <View style={{ flex: 1 }}>
              <AppText variant="headline" color={resultColor}>
                {result.title}
              </AppText>
              <AppText variant="callout" tone="inverse" numberOfLines={2}>
                {result.detail}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: t.c.scrimStrong, borderColor: t.c.onImageBorder }]}>
            <Ionicons name="scan-outline" size={26} color={t.c.gold} />
            <AppText variant="callout" tone="inverse" style={{ flex: 1 }}>
              {serveMode ? 'Point at a volunteer’s pass QR code.' : 'Point at a ticket QR code. Check-in happens automatically.'}
            </AppText>
          </View>
        )}

        {recent.length > 1 ? (
          <View style={[styles.recent, { backgroundColor: t.c.scrimStrong }]}>
            <AppText variant="overline" color={t.c.onImageMuted} style={{ marginBottom: 4 }}>
              Recent scans
            </AppText>
            {recent.slice(1).map(r => (
              <View key={r.id} style={styles.recentRow}>
                <Ionicons name={r.outcome === 'ok' ? 'checkmark' : r.outcome === 'fail' ? 'close' : 'repeat'} size={14} color={r.outcome === 'ok' ? t.c.success : r.outcome === 'fail' ? t.c.danger : t.c.gold} />
                <AppText variant="caption" tone="inverse" numberOfLines={1} style={{ flex: 1 }}>
                  {r.title} · {r.detail}
                </AppText>
                <AppText variant="caption" color={t.c.onImageMuted}>
                  {timeAgo(new Date(r.at).toISOString())}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Enter code" icon="keypad-outline" variant="secondary" onPress={() => setManualOpen(true)} style={{ flex: 1 }} fullWidth />
          {!serveMode ? <Button title="Change event" icon="swap-horizontal" variant="secondary" onPress={() => setPickerOpen(true)} style={{ flex: 1 }} fullWidth /> : null}
        </View>
      </View>

      <ManualSheet
        visible={manualOpen}
        code={manualCode}
        onChange={setManualCode}
        busy={processing}
        onClose={() => setManualOpen(false)}
        onSubmit={() => {
          setManualOpen(false);
          handleScan(manualCode.trim(), 'manual');
          setManualCode('');
        }}
      />

      <BottomSheet
        visible={pickerOpen}
        onClose={() => (eventId ? setPickerOpen(false) : close())}
        title="Which event?"
        subtitle="Tickets are checked in against the event you choose."
      >
        {events === null ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height={56} radius={t.radius.md} />
            ))}
          </View>
        ) : events.length === 0 ? (
          <EmptyState compact art="calendar" title="No live or upcoming events" body="Publish an event to start checking guests in." actionLabel="Go to Host" onAction={() => router.replace('/(tabs)/host')} />
        ) : (
          <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 }}>
            {events.map((e, i) => (
              <ListRow
                key={e.id}
                icon={e.id === eventId ? 'checkmark-circle' : 'calendar-outline'}
                title={e.name}
                subtitle={`${formatDateShort(e.start_date)} · ${formatTime(e.start_date)}`}
                onPress={() => {
                  setEventId(e.id);
                  setEventName(e.name);
                  setPickerOpen(false);
                  setAttendance(null);
                  seen.current.clear();
                  router.setParams({ eventId: e.id });
                }}
                last={i === events.length - 1}
              />
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function ManualSheet({ visible, code, onChange, onClose, onSubmit, busy }: { visible: boolean; code: string; onChange: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Enter code"
      subtitle="Type the code printed under the QR."
      footer={<Button title="Check in" fullWidth onPress={onSubmit} disabled={code.trim().length < 4} loading={busy} />}
    >
      <Field
        value={code}
        onChangeText={v => onChange(v.toUpperCase())}
        placeholder="e.g. 7F3K9QPL"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => code.trim().length >= 4 && onSubmit()}
        accessibilityLabel="Ticket or pass code"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 48 },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  banner: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5 },
  recent: { padding: 12, borderRadius: 16, gap: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
