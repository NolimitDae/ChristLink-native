import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyTickets, getRsvp } from '../../lib/api';
import { logger } from '../../lib/logger';
import type { Ticket } from '../../lib/types';

/** Whether the signed-in user is going to an event: a confirmed RSVP or at least one confirmed ticket. */
export function useAttendance(eventId?: string) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rsvp, setRsvp] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !eventId) {
      setRsvp(false);
      setTickets([]);
      setLoaded(true);
      return;
    }
    const [r, t] = await Promise.allSettled([getRsvp(eventId, token), getMyTickets(token)]);
    if (r.status === 'fulfilled') setRsvp(r.value.rsvp?.status === 'confirmed');
    else logger.warn('RSVP status not loaded', { error: String(r.reason) });
    if (t.status === 'fulfilled') setTickets(t.value.tickets.filter(x => x.event_id === eventId && x.status === 'confirmed'));
    setLoaded(true);
  }, [token, eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rsvp, setRsvp, tickets, loaded, refresh, attending: rsvp || tickets.length > 0 };
}
