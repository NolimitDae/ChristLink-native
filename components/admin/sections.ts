import type { AppIconName as IconName } from '../icons/AppIcon';

export type AdminSection = 'reports' | 'verifications' | 'users' | 'events' | 'promo-codes' | 'payouts' | 'posts' | 'churches' | 'verses' | 'tools';

/** Admin areas, in the order the dashboard lists them (app/admin/[section].tsx renders each). */
export const ADMIN_SECTIONS: { key: AdminSection; title: string; subtitle: string; icon: IconName }[] = [
  { key: 'reports', title: 'Reports', subtitle: 'Reported posts, prayers, profiles and events', icon: 'flag-outline' },
  { key: 'verifications', title: 'Host verification', subtitle: 'Approve ID checks for paid events', icon: 'id-card-outline' },
  { key: 'users', title: 'Users', subtitle: 'Search, roles, payout accounts', icon: 'people-outline' },
  { key: 'events', title: 'Events', subtitle: 'Search, cancel or delete events', icon: 'calendar-outline' },
  { key: 'promo-codes', title: 'Promo codes', subtitle: 'Listing-fee discounts for hosts', icon: 'pricetag-outline' },
  { key: 'payouts', title: 'Host payouts', subtitle: 'Paid after each event; held and due amounts', icon: 'wallet-outline' },
  { key: 'posts', title: 'Community posts', subtitle: 'Latest posts; remove anything off-topic', icon: 'chatbubbles-outline' },
  { key: 'churches', title: 'Church claims', subtitle: 'Approve church page owners', icon: 'church-outline' },
  { key: 'verses', title: 'Verses', subtitle: 'Verse of the day rotation', icon: 'bible-outline' },
  { key: 'tools', title: 'Tools', subtitle: 'Test push, style guide', icon: 'construct-outline' },
];
