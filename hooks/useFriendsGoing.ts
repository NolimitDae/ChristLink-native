import { useEffect, useState } from 'react';
import { getFriendsGoing } from '../lib/features';
import type { FriendsGoing } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';

/** Mutual-follow friends going to each event (falls back to an empty map when signed out or not deployed). */
export function useFriendsGoing(eventIds: string[]): Record<string, FriendsGoing> {
  const { session } = useAuth();
  const [map, setMap] = useState<Record<string, FriendsGoing>>({});
  const key = [...eventIds].sort().join(',');
  useEffect(() => {
    let cancelled = false;
    if (!session || !key) {
      setMap({});
      return;
    }
    getFriendsGoing(key.split(',')).then(m => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [key, session]);
  return map;
}
