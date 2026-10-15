import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { EmptyState, Skeleton, SkeletonGroup } from '../ui';
import type { LineArtName } from '../ui/LineArt';
import type { LoadState } from './useLoad';

/** Shared loading / not-set-up / error / empty handling for admin panels. Returns null when there is data to show. */
export function PanelState<T>({ state, art, emptyTitle, emptyBody, isEmpty }: { state: LoadState<T>; art: LineArtName; emptyTitle: string; emptyBody?: string; isEmpty: (d: T) => boolean }) {
  const t = useTheme();
  if (state.loading) {
    return (
      <SkeletonGroup>
        <View style={{ gap: t.space.sm }}>
          {[0, 1, 2].map(i => (
            <Skeleton key={i} height={110} radius={t.radius.lg} />
          ))}
        </View>
      </SkeletonGroup>
    );
  }
  if (state.notSetUp) return <EmptyState compact art={art} title="Coming soon" body="This tool needs the latest database migration before it can be used." />;
  if (state.error) return <EmptyState compact art={art} title="Couldn’t load" body={state.error} actionLabel="Try again" onAction={state.reload} />;
  if (!state.data || isEmpty(state.data)) return <EmptyState compact art={art} title={emptyTitle} body={emptyBody} />;
  return null;
}
