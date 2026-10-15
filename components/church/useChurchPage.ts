import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getEvent, getEvents } from '../../lib/api';
import { getChurch, getChurchEventIds, getChurchRecurring, getOpenShifts, isFollowingChurch } from '../../lib/features';
import { logger } from '../../lib/logger';
import type { Church, ChurchRecurringEvent, Event, ServeShift } from '../../lib/types';
import { errorMessage, isNotSetUp } from './churchFormat';

export type ChurchLoad =
  | { kind: 'loading' }
  | { kind: 'ready'; church: Church }
  | { kind: 'notFound' }
  | { kind: 'notSetUp' }
  | { kind: 'error'; message: string };

const HOUR = 3_600_000;

async function churchEvents(church: Church): Promise<Event[]> {
  const ids = await getChurchEventIds(church.id).catch(() => [] as string[]);
  const [linked, hosted] = await Promise.all([
    Promise.allSettled(ids.slice(0, 20).map(id => getEvent(id))),
    church.claimed_by ? getEvents({ host_id: church.claimed_by, limit: 20 }).catch(() => ({ events: [] as Event[] })) : Promise.resolve({ events: [] as Event[] }),
  ]);
  const byId = new Map<string, Event>();
  linked.forEach(r => {
    if (r.status === 'fulfilled') byId.set(r.value.id, r.value);
  });
  hosted.events.forEach(e => byId.set(e.id, e));
  const cutoff = Date.now() - 2 * HOUR;
  return [...byId.values()]
    .filter(e => e.status !== 'cancelled' && e.status !== 'draft' && (!e.start_date || new Date(e.start_date).getTime() > cutoff))
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
}

export function useChurchPage(id: string | undefined) {
  const { session } = useAuth();
  const [state, setState] = useState<ChurchLoad>({ kind: 'loading' });
  const [recurring, setRecurring] = useState<ChurchRecurringEvent[]>([]);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [shifts, setShifts] = useState<ServeShift[]>([]);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: 'notFound' });
      return;
    }
    try {
      const church = await getChurch(id);
      if (!church) {
        setState({ kind: 'notFound' });
        return;
      }
      setState({ kind: 'ready', church });
      const [rec, evs, sh, fol] = await Promise.allSettled([
        getChurchRecurring(id),
        churchEvents(church),
        getOpenShifts({ churchId: id }),
        session ? isFollowingChurch(id) : Promise.resolve(false),
      ]);
      setRecurring(rec.status === 'fulfilled' ? rec.value : []);
      setEvents(evs.status === 'fulfilled' ? evs.value : []);
      setShifts(sh.status === 'fulfilled' ? sh.value.filter(s => new Date(s.ends_at).getTime() > Date.now()) : []);
      setFollowing(fol.status === 'fulfilled' ? fol.value : false);
    } catch (err) {
      if (isNotSetUp(err)) setState({ kind: 'notSetUp' });
      else {
        logger.warn('Church page failed', { error: String(err) });
        setState({ kind: 'error', message: errorMessage(err) });
      }
    }
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  return { state, recurring, events, shifts, following, setFollowing, reload: load };
}
