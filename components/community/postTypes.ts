import type { AppIconName } from '../icons/AppIcon';
import type { PostType } from '../../lib/types';

type IconName = AppIconName;

export const COMPOSER_TYPES = ['prayer', 'praise', 'testimony', 'encouragement'] as const;
export type ComposerType = (typeof COMPOSER_TYPES)[number];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  prayer: 'Prayer',
  praise: 'Praise',
  testimony: 'Testimony',
  encouragement: 'Encouragement',
  answered: 'Answered',
};

export const POST_TYPE_ICON: Record<PostType, IconName> = {
  prayer: 'pray-outline',
  praise: 'musical-notes-outline',
  testimony: 'chatbubble-ellipses-outline',
  encouragement: 'sunny-outline',
  answered: 'sparkles-outline',
};

export function isShareable(type?: PostType | null): boolean {
  return type === 'testimony' || type === 'answered';
}
