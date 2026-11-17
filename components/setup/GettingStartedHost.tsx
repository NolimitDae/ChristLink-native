import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useGettingStarted } from '../../contexts/GettingStartedContext';
import { SetupCelebration } from './SetupCelebration';

/** Screens the welcome tour never interrupts. */
const QUIET = new Set(['auth', 'onboarding', 'welcome', 'get-started', 'legal', 'host']);

/**
 * Lives next to the navigator: opens the welcome tour once for a new account (after sign-in finishes), re-checks
 * the setup checklist as people move around the app, and shows the thank-you when the last step is done.
 */
export function GettingStartedHost() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { session } = useAuth();
  const { status, refreshSoon, celebrating, endCelebration } = useGettingStarted();
  const opened = useRef<string | null>(null);
  const first = segments[0] as string | undefined;

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || !status?.welcome || opened.current === uid || (first && QUIET.has(first))) return;
    opened.current = uid;
    router.push('/get-started');
  }, [session?.user.id, status?.welcome, first, router]);

  // Finishing a step usually means coming back from another screen: look again then (at most every 15 s)
  useEffect(() => {
    if (status?.show) refreshSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return <SetupCelebration visible={celebrating} onClose={endCelebration} />;
}
