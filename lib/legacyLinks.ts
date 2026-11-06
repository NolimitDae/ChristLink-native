/**
 * Links shared from the old website used hash routes (christlinksocial.com/#event/<id>). The new web app has real
 * paths, so on load those hashes are turned into the matching route. Returns null when the hash isn't an old route.
 */
const ID = /^[A-Za-z0-9-]{1,64}$/;
const PAGES: Record<string, string> = {
  home: '/',
  browse: '/explore',
  community: '/community',
  host: '/host',
  profile: '/profile',
};

export function legacyHashRoute(hash: string): string | null {
  const [page, id] = hash.replace(/^#\/?/, '').split('/');
  if (!page) return null;
  if (id !== undefined) {
    if (!ID.test(id)) return null;
    if (page === 'event') return `/event/${id}`;
    if (page === 'forum') return `/event/${id}/forum`;
    if (page === 'user') return `/user/${id}`;
    return null;
  }
  return PAGES[page] ?? null;
}
