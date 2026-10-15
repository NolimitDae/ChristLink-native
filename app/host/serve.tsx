import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getEvent, getMyEvents } from '../../lib/api';
import {
  completeShift,
  createServeRole,
  getChurch,
  getMyManagedChurches,
  getMyManagedShifts,
  getShiftRoster,
  messageVolunteers,
  type ManagedShift,
} from '../../lib/features';
import { formatDateShort, pluralize } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { Church, Event, ServeRosterEntry } from '../../lib/types';
import { AppText, BottomSheet, Button, EmptyState, Field, ListRow, Screen, SectionHeader, Skeleton, SkeletonGroup } from '../../components/ui';
import { RoleForm, RosterRow, ShiftCard, newShift, validateRole, type RoleDraft } from '../../components/host/ServeParts';
import { errorMessage, isNotSetUp } from '../../components/host/errors';

interface Target {
  kind: 'event' | 'church';
  id: string;
  name?: string;
  start?: Date | null;
  end?: Date | null;
}

export default function ServeManageScreen() {
  const params = useLocalSearchParams<{ eventId?: string; churchId?: string }>();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;

  const initial: Target | null = params.eventId ? { kind: 'event', id: params.eventId } : params.churchId ? { kind: 'church', id: params.churchId } : null;
  const [target, setTarget] = useState<Target | null>(initial);
  const [notSetUp, setNotSetUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickEvents, setPickEvents] = useState<Event[] | null>(null);
  const [pickChurches, setPickChurches] = useState<Church[]>([]);

  const [shifts, setShifts] = useState<ManagedShift[]>([]);
  const [filled, setFilled] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(!!initial);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [role, setRole] = useState<RoleDraft>({ name: '', description: '', requirements: '', shifts: [] });
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [rosterShift, setRosterShift] = useState<ManagedShift | null>(null);
  const [roster, setRoster] = useState<ServeRosterEntry[] | null>(null);
  const [msgShift, setMsgShift] = useState<ManagedShift | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target || !token) return;
    Promise.allSettled([getMyEvents(token), getMyManagedChurches()]).then(([ev, ch]) => {
      const now = Date.now();
      setPickEvents(
        ev.status === 'fulfilled'
          ? ev.value.events
              .filter(e => e.status !== 'cancelled' && (!e.start_date || new Date(e.end_date ?? e.start_date).getTime() > now - 86_400_000))
              .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
          : [],
      );
      if (ch.status === 'fulfilled') setPickChurches(ch.value);
    });
  }, [target, token]);

  useEffect(() => {
    if (!target || target.name) return;
    if (target.kind === 'event') {
      getEvent(target.id, token)
        .then(e => setTarget(prev => (prev && prev.id === e.id ? { ...prev, name: e.name, start: e.start_date ? new Date(e.start_date) : null, end: e.end_date ? new Date(e.end_date) : null } : prev)))
        .catch(() => undefined);
    } else {
      getChurch(target.id)
        .then(c => c && setTarget(prev => (prev && prev.id === c.id ? { ...prev, name: c.name } : prev)))
        .catch(() => undefined);
    }
  }, [target, token]);

  const load = useCallback(async () => {
    if (!target) return;
    setError(null);
    try {
      const all = await getMyManagedShifts();
      const mine = all.filter(sh => (target.kind === 'event' ? sh.serve_roles.event_id === target.id : sh.serve_roles.church_id === target.id));
      setShifts(mine);
      const counts = await Promise.allSettled(mine.map(sh => getShiftRoster(sh.id)));
      const map: Record<string, number> = {};
      counts.forEach((r, i) => {
        if (r.status === 'fulfilled') map[mine[i].id] = r.value.length;
      });
      setFilled(map);
    } catch (err) {
      if (isNotSetUp(err)) setNotSetUp(true);
      else setError(errorMessage(err, 'Could not load shifts.'));
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (target) {
      setLoading(true);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: shifts.filter(sh => !sh.completed_at && new Date(sh.ends_at).getTime() > now),
      past: shifts.filter(sh => sh.completed_at || new Date(sh.ends_at).getTime() <= now),
    };
  }, [shifts]);

  const openForm = () => {
    setRole({ name: '', description: '', requirements: '', shifts: [newShift(target?.start ?? null, target?.end ?? null)] });
    setRoleErrors({});
    setFormOpen(true);
  };

  const saveRole = async () => {
    if (!target) return;
    const errs = validateRole(role);
    setRoleErrors(errs);
    if (Object.keys(errs).length > 0) {
      haptic.warning();
      return;
    }
    setSaving(true);
    try {
      await createServeRole({
        event_id: target.kind === 'event' ? target.id : null,
        church_id: target.kind === 'church' ? target.id : null,
        name: role.name.trim(),
        description: role.description.trim() || undefined,
        requirements: role.requirements.trim() || undefined,
        shifts: role.shifts.map(sh => ({ starts_at: (sh.start as Date).toISOString(), ends_at: (sh.end as Date).toISOString(), spots: Number(sh.spots) })),
      });
      haptic.success();
      showToast(`${role.name.trim()} is open for sign-ups`, 'success');
      setFormOpen(false);
      await load();
    } catch (err) {
      if (isNotSetUp(err)) setNotSetUp(true);
      showToast(errorMessage(err, 'Could not create the role'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openRoster = async (sh: ManagedShift) => {
    setRosterShift(sh);
    setRoster(null);
    try {
      setRoster(await getShiftRoster(sh.id));
    } catch (err) {
      setRoster([]);
      showToast(errorMessage(err), 'error');
    }
  };

  const send = async () => {
    if (!msgShift || !message.trim()) return;
    setSending(true);
    try {
      const n = await messageVolunteers(msgShift.id, message.trim());
      showToast(`Sent to ${pluralize(Number(n) || 0, 'volunteer')}`, 'success');
      setMsgShift(null);
      setMessage('');
    } catch (err) {
      showToast(errorMessage(err, 'Message not sent'), 'error');
    } finally {
      setSending(false);
    }
  };

  const complete = (sh: ManagedShift) => {
    Alert.alert('Complete this shift?', 'Checked-in volunteers get their hours credited. Anyone who didn’t check in is marked as a no-show.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            const n = await completeShift(sh.id);
            haptic.success();
            showToast(`${pluralize(Number(n) || 0, 'volunteer')} marked complete`, 'success');
            await load();
          } catch (err) {
            showToast(errorMessage(err), 'error');
          }
        },
      },
    ]);
  };

  if (!session) {
    return (
      <Screen title="Serve teams" back>
        <EmptyState art="serve" title="Build a volunteer team" body="Sign in to create serve roles and shifts." actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  if (notSetUp) {
    return (
      <Screen title="Serve teams" back>
        <EmptyState art="serve" title="Serve is almost ready" body="Volunteer sign-ups are being set up. Please check back soon." actionLabel="Back to Host" onAction={() => router.back()} />
      </Screen>
    );
  }

  if (!target) {
    return (
      <Screen title="Serve teams" back>
        <ScrollView contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl }}>
          <AppText variant="callout" tone="muted" style={{ marginBottom: t.space.lg }}>
            Choose an event or church to manage its volunteer roles and shifts.
          </AppText>
          {pickEvents === null ? (
            <SkeletonGroup>
              <View style={{ gap: 10 }}>
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} height={58} radius={t.radius.md} />
                ))}
              </View>
            </SkeletonGroup>
          ) : pickEvents.length === 0 && pickChurches.length === 0 ? (
            <EmptyState art="serve" title="Nothing to staff yet" body="Create an event first, then add volunteer roles to it." actionLabel="Create an event" onAction={() => router.push('/event/create')} />
          ) : (
            <>
              {pickEvents.length > 0 ? (
                <>
                  <SectionHeader title="Your events" style={{ paddingHorizontal: 0 }} />
                  <View style={s.group}>
                    {pickEvents.map((e, i) => (
                      <ListRow
                        key={e.id}
                        icon="calendar-outline"
                        title={e.name}
                        subtitle={formatDateShort(e.start_date)}
                        onPress={() => setTarget({ kind: 'event', id: e.id, name: e.name, start: e.start_date ? new Date(e.start_date) : null, end: e.end_date ? new Date(e.end_date) : null })}
                        last={i === pickEvents.length - 1}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              {pickChurches.length > 0 ? (
                <>
                  <SectionHeader title="Your churches" style={{ paddingHorizontal: 0, marginTop: t.space.lg }} />
                  <View style={s.group}>
                    {pickChurches.map((c, i) => (
                      <ListRow key={c.id} icon="business-outline" title={c.name} subtitle={c.city ?? undefined} onPress={() => setTarget({ kind: 'church', id: c.id, name: c.name })} last={i === pickChurches.length - 1} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen title="Serve teams" back>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.c.gold} colors={[t.c.gold]} />}
      >
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="gold">
              {target.kind === 'event' ? 'Event' : 'Church'}
            </AppText>
            <AppText variant="title3" numberOfLines={2}>
              {target.name ?? 'Loading…'}
            </AppText>
          </View>
          {!initial ? <Button title="Change" variant="ghost" size="sm" onPress={() => setTarget(null)} /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <Button title="New role" icon="add" onPress={openForm} style={{ flex: 1 }} fullWidth />
          <Button title="Check in" icon="qr-code-outline" variant="secondary" onPress={() => router.push('/host/scan?mode=serve')} style={{ flex: 1 }} fullWidth />
        </View>

        {loading ? (
          <SkeletonGroup label="Loading shifts">
            <View style={{ gap: t.space.sm }}>
              {[0, 1].map(i => (
                <Skeleton key={i} height={150} radius={t.radius.lg} />
              ))}
            </View>
          </SkeletonGroup>
        ) : error ? (
          <EmptyState compact art="serve" title="Couldn’t load shifts" body={error} actionLabel="Try again" onAction={load} />
        ) : shifts.length === 0 ? (
          <EmptyState compact art="serve" title="No volunteer roles yet" body="Add roles like greeters, parking or worship tech, then share the event so people can sign up." actionLabel="Create a role" onAction={openForm} />
        ) : (
          <>
            {upcoming.length > 0 ? <SectionHeader title="Upcoming shifts" style={{ paddingHorizontal: 0, marginBottom: 0 }} /> : null}
            {upcoming.map(sh => (
              <ShiftCard
                key={sh.id}
                shift={sh}
                filled={filled[sh.id] ?? null}
                onRoster={() => openRoster(sh)}
                onMessage={() => setMsgShift(sh)}
                onComplete={() => complete(sh)}
                onCheckIn={() => router.push('/host/scan?mode=serve')}
              />
            ))}
            {past.length > 0 ? <SectionHeader title="Past shifts" style={{ paddingHorizontal: 0, marginBottom: 0, marginTop: t.space.sm }} /> : null}
            {past.map(sh => (
              <ShiftCard
                key={sh.id}
                shift={sh}
                filled={filled[sh.id] ?? null}
                onRoster={() => openRoster(sh)}
                onMessage={() => setMsgShift(sh)}
                onComplete={() => complete(sh)}
                onCheckIn={() => router.push('/host/scan?mode=serve')}
              />
            ))}
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title="New serve role"
        subtitle={target.name}
        footer={<Button title="Create role" fullWidth onPress={saveRole} loading={saving} />}
      >
        <RoleForm draft={role} onChange={setRole} errors={roleErrors} defaultStart={target.start} defaultEnd={target.end} />
      </BottomSheet>

      <BottomSheet
        visible={!!rosterShift}
        onClose={() => setRosterShift(null)}
        title={rosterShift?.serve_roles.name ?? 'Roster'}
        subtitle={rosterShift ? `${formatDateShort(rosterShift.starts_at)} · ${roster ? `${roster.length}/${rosterShift.spots} filled` : ''}` : undefined}
      >
        {roster === null ? (
          <SkeletonGroup>
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height={48} radius={t.radius.md} />
              ))}
            </View>
          </SkeletonGroup>
        ) : roster.length === 0 ? (
          <EmptyState compact art="people" title="No sign-ups yet" body="Share the event so people can volunteer." />
        ) : (
          roster.map((r, i) => <RosterRow key={r.id} entry={r} last={i === roster.length - 1} />)
        )}
      </BottomSheet>

      <BottomSheet
        visible={!!msgShift}
        onClose={() => setMsgShift(null)}
        title="Message volunteers"
        subtitle={msgShift ? `${msgShift.serve_roles.name} · ${formatDateShort(msgShift.starts_at)}` : undefined}
        footer={<Button title="Send" icon="send" fullWidth onPress={send} loading={sending} disabled={!message.trim()} />}
      >
        <Field value={message} onChangeText={setMessage} placeholder="Arrive 15 minutes early — parking is behind the hall." multiline maxLength={500} accessibilityLabel="Message" hint="Sent as a notification to everyone signed up." />
      </BottomSheet>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  between: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14 },
}));
