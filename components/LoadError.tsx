import React from 'react';
import { useRouter } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';
import type { LoadFailure } from '../lib/loadFailure';
import { EmptyState } from './ui';
import type { LineArtName } from './ui/LineArt';

/**
 * Empty state for a list or page that failed to load (lib/loadFailure.ts). Only a real connection problem says
 * "check your connection"; signed-out visitors get a sign-in button; server errors say it's on our side.
 */
export function LoadError({
  failure,
  what,
  onRetry,
  art = 'cross',
  compact,
  style,
}: {
  failure: LoadFailure;
  /** What didn't load, as in "Couldn't load {what}": "prayers", "the feed". */
  what: string;
  onRetry: () => void;
  /** Illustration for the sign-in and server cases (the connection case always shows the offline art). */
  art?: LineArtName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  if (failure === 'signin') {
    return (
      <EmptyState
        art={art}
        title="Sign in to see this"
        body="This is for Christ Link members. Sign in with your email to continue."
        actionLabel="Sign in"
        onAction={() => router.push('/auth')}
        compact={compact}
        style={style}
      />
    );
  }
  return (
    <EmptyState
      art={failure === 'offline' ? 'offline' : art}
      title={`Couldn’t load ${what}`}
      body={failure === 'offline' ? 'Check your connection and try again.' : 'Something went wrong on our side. Please try again in a moment.'}
      actionLabel="Try again"
      onAction={onRetry}
      compact={compact}
      style={style}
    />
  );
}
