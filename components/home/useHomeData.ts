import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { getEvents, getMyRsvps, getMyTickets } from '../../lib/api';
import { getChurchEventIds } from '../../lib/features';
import type { Event } from '../../lib/types';
import { errorMessage } from '../church/churchFormat';
import type { Plan } from './types';

export function useHomeData() {
  const { session } = useAuth();
  const { settings } = useAppData();
  const token = session?.access_token;
  const homeChurchId = settings?.home_church_id ?? null;

  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [churchEventIds, setChurchEventIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadEvents = useCallback(async () => {
    try {
      const res = await getEvents({ limit: 60 });
      setEvents(res.events);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load events.'));
    }
  }, []);

  const loadPlans = useCallback(async () => {
    if (!token) {
      setPlans([]);
      setPlansLoaded(true);
      return;
    }
    const [rsvps, tickets] = await Promise.allSettled([getMyRsvps(token), getMyTickets(token)]);
    const out = new Map<string, Plan>();
    if (rsvps.status === 'fulfilled') {
      for (const r of rsvps.value.rsvps) {
        if (r.status !== 'confirmed' || !r.event_start_date) continue;
        out.set(r.event_id, { eventId: r.event_id, name: r.event_name ?? 'Event', start: r.event_start_date, kind: 'rsvp' });
      }
    }
    if (tickets.status === 'fulfilled') {
      for (const tk of tickets.value.tickets) {
        if (tk.status !== 'confirmed' || !tk.event_start_date) continue;
        out.set(tk.event_id, { eventId: tk.event_id, name: tk.event_name ?? 'Event', start: tk.event_start_date, kind: 'ticket' });
      }
    }
    setPlans([...out.values()]);
    setPlansLoaded(true);
  }, [token]);

  const loadChurchEvents = useCallback(async () => {
    if (!homeChurchId) {
      setChurchEventIds([]);
      return;
    }
    try {
      setChurchEventIds(await getChurchEventIds(homeChurchId));
    } catch {
      setChurchEventIds([]);
    }
  }, [homeChurchId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    loadChurchEvents();
  }, [loadChurchEvents]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    await Promise.all([loadEvents(), loadPlans(), loadChurchEvents()]);
    setRefreshing(false);
  }, [loadEvents, loadPlans, loadChurchEvents]);

  const retry = useCallback(() => {
    setError(null);
    loadEvents();
  }, [loadEvents]);

  return { events, error, plans, plansLoaded, churchEventIds, homeChurchId, refreshing, refreshKey, refresh, retry };
}
