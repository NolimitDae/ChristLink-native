import { ApiError } from './api';
import { FeatureError } from './features';

/**
 * Why a screen couldn't load, so it can say the right thing instead of always blaming the connection:
 * - offline: the request never got an answer (no network, timeout)
 * - signin: the API wants a signed-in member (not signed in, or the session ended)
 * - server: the API answered with an error
 */
export type LoadFailure = 'offline' | 'signin' | 'server';

export function loadFailure(err: unknown): LoadFailure {
  const status = err instanceof ApiError ? err.status : err instanceof FeatureError ? err.status : undefined;
  if (status === 401) return 'signin';
  if (status === 0) return 'offline';
  return 'server';
}
