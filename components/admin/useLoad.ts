import { useCallback, useEffect, useState } from 'react';
import { errorMessage, isNotSetUp } from '../host/errors';

export interface LoadState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notSetUp: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** Loads once on mount (and whenever `fn` changes); `refresh` is for pull-to-refresh. */
export function useLoad<T>(fn: () => Promise<T>): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await fn());
      setNotSetUp(false);
    } catch (err) {
      if (isNotSetUp(err)) setNotSetUp(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, loading, refreshing, error, notSetUp, reload, refresh };
}
