import type { AppIconName } from '../components/icons/AppIcon';
import type { GettingStarted, SetupStepId } from './types';

/**
 * What each setup step says and what tapping it does (components/setup/SetupChecklist.tsx). `photo` and `cover`
 * open the photo picker right there; `profile` opens the profile editor; a route opens that screen.
 */
export type SetupAction = { kind: 'photo' | 'cover' | 'profile' } | { kind: 'route'; to: string };

export const SETUP_STEP_COPY: Record<SetupStepId, { title: string; body: string; icon: AppIconName; action: SetupAction }> = {
  photo: { title: 'Add a profile photo', body: 'Help friends recognize you.', icon: 'camera-outline', action: { kind: 'photo' } },
  cover: { title: 'Add a cover photo', body: 'A picture across the top of your profile.', icon: 'image-outline', action: { kind: 'cover' } },
  bio: { title: 'Write a short bio', body: 'A line or two about you and your faith.', icon: 'create-outline', action: { kind: 'profile' } },
  interests: { title: 'Add your interests', body: 'Hobbies and what you’d like to connect over.', icon: 'heart-outline', action: { kind: 'profile' } },
  church: { title: 'Choose your home church', body: 'See its services and gatherings first.', icon: 'church-outline', action: { kind: 'route', to: '/explore?tab=churches' } },
  post: { title: 'Share your first post', body: 'Say hello in Community or share a prayer request.', icon: 'chatbubble-outline', action: { kind: 'route', to: '/community' } },
  event: { title: 'RSVP to an event', body: 'Find something this week and tap “I’m going”.', icon: 'calendar-outline', action: { kind: 'route', to: '/explore?tab=events' } },
};

/** Steps in two groups, in the order the checklist shows them. */
export const SETUP_GROUPS: { title: string; steps: SetupStepId[] }[] = [
  { title: 'Your profile', steps: ['photo', 'cover', 'bio', 'interests', 'church'] },
  { title: 'Get involved', steps: ['post', 'event'] },
];

/** 0–1, for the progress bar. */
export function setupProgress(status: Pick<GettingStarted, 'done' | 'total'> | null | undefined): number {
  if (!status || status.total <= 0) return 0;
  return Math.max(0, Math.min(1, status.done / status.total));
}

/** The short line under the checklist title. */
export function setupSummary(status: Pick<GettingStarted, 'done' | 'total'>): string {
  const left = status.total - status.done;
  if (left <= 0) return 'All done. Thank you!';
  if (status.done === 0) return `${status.total} quick steps to make this place yours.`;
  return left === 1 ? 'One step left.' : `${left} steps left.`;
}

/** Whether the bell gets a dot for the checklist. */
export function setupPending(status: GettingStarted | null | undefined): boolean {
  return !!status && status.show && status.done < status.total;
}
