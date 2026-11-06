/**
 * Profile setup options, identical to the website's Edit Profile so both read and write the same values:
 * avatar_color = CSS gradient, avatar_ring_color = hex or null, hobbies = labels joined by ", ",
 * connect_tags = ids, bible_version = translation code.
 */
import type { AppIconName } from '../components/icons/AppIcon';

type IconName = AppIconName;

/** Avatar backgrounds when there is no photo (web values; shown as gradients through components/Avatar). */
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#C9A84C,#6B4A00)',
  'linear-gradient(135deg,#3B6FE8,#1E3A8A)',
  'linear-gradient(135deg,#7C3AED,#4C1D95)',
  'linear-gradient(135deg,#059669,#064E3B)',
  'linear-gradient(135deg,#DC2626,#7F1D1D)',
  'linear-gradient(135deg,#D97706,#78350F)',
  'linear-gradient(135deg,#0891B2,#164E63)',
  'linear-gradient(135deg,#BE185D,#500724)',
] as const;

/** Ring around the avatar; `null` = no ring. */
export const RING_COLORS = [null, '#C9A84C', '#9B5DE5', '#5B8DEF', '#6CC48C', '#FF6BAE', '#D9534F', '#E8896A', '#55BFD6', '#FFFFFF'] as const;

export const BIBLE_VERSIONS = ['NIV', 'ESV', 'KJV', 'NKJV', 'NLT', 'NASB', 'CSB', 'MSG', 'AMP'] as const;
export const DEFAULT_BIBLE_VERSION = 'NIV';

export const HOBBIES: { label: string; icon: IconName }[] = [
  { label: 'Roller Skating', icon: 'skate-outline' },
  { label: 'Swimming', icon: 'water-outline' },
  { label: 'Hiking', icon: 'trail-sign-outline' },
  { label: 'Reading', icon: 'book-outline' },
  { label: 'Praying', icon: 'pray-outline' },
  { label: 'Bible Study', icon: 'bible-outline' },
  { label: 'Worship', icon: 'mic-outline' },
  { label: 'Volunteering', icon: 'ribbon-outline' },
  { label: 'Mentorship', icon: 'school-outline' },
  { label: 'Fitness', icon: 'barbell-outline' },
  { label: 'Content Creation', icon: 'videocam-outline' },
  { label: 'Photography', icon: 'camera-outline' },
  { label: 'Traveling', icon: 'airplane-outline' },
  { label: 'Cooking', icon: 'restaurant-outline' },
  { label: 'Music', icon: 'musical-notes-outline' },
  { label: 'Church Events', icon: 'church-outline' },
  { label: 'Fellowship', icon: 'people-circle-outline' },
  { label: 'Community Outreach', icon: 'megaphone-outline' },
  { label: 'Serving', icon: 'serve-outline' },
  { label: 'Resting', icon: 'bed-outline' },
];

export const CONNECT_OPTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'prayer', label: 'Prayer Partner', icon: 'pray-outline' },
  { id: 'bible', label: 'Bible Study Buddy', icon: 'bible-outline' },
  { id: 'meetup', label: 'Meet Up at Events', icon: 'calendar-outline' },
  { id: 'worship', label: 'Worship Team', icon: 'mic-outline' },
  { id: 'volunteer', label: 'Volunteering', icon: 'serve-outline' },
  { id: 'chat', label: 'Just Chatting', icon: 'chatbubbles-outline' },
  { id: 'mentorship', label: 'Mentorship', icon: 'school-outline' },
  { id: 'family', label: 'Family & Parenting', icon: 'home-outline' },
  { id: 'fellowship', label: 'Fellowship', icon: 'people-circle-outline' },
  { id: 'new-friends', label: 'New Friends', icon: 'person-add-outline' },
];

export const LIMITS = { hotTakes: 300, prayerRequest: 400, testimony: 600 } as const;

/** "Swimming, Reading" → ['Swimming', 'Reading'] (trims, drops empties and duplicates). */
export function parseHobbies(value: string | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of (value ?? '').split(',')) {
    const h = raw.trim();
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

/** Stores hobbies the way the website does: known ones in list order, then any custom ones, joined by ", ". */
export function formatHobbies(selected: string[]): string {
  const known = HOBBIES.map(h => h.label).filter(l => selected.includes(l));
  const custom = selected.filter(s => !HOBBIES.some(h => h.label === s));
  return [...known, ...custom].join(', ');
}

/** Adds or removes `item`, keeping the rest in order. */
export function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

/** Accepts "@handle", "handle", "site.com/handle" or a full URL; returns an https URL or ''. */
export function normalizeSocial(input: string, site: 'instagram.com' | 'facebook.com' | 'tiktok.com'): string {
  const v = input.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const bare = v.replace(new RegExp(`^(www\\.)?${site.replace('.', '\\.')}/`, 'i'), '');
  const handle = site === 'tiktok.com' ? `@${bare.replace(/^@/, '')}` : bare.replace(/^@/, '');
  return `https://${site}/${handle}`;
}
