import { CONNECT_OPTIONS, HOBBIES, formatHobbies, normalizeSocial, parseHobbies, toggle } from '../../lib/profileOptions';

describe('hobbies', () => {
  it('parses the website format', () => {
    expect(parseHobbies('Roller Skating, Swimming,  Bible Study , ,Swimming')).toEqual(['Roller Skating', 'Swimming', 'Bible Study']);
    expect(parseHobbies(null)).toEqual([]);
  });
  it('formats in list order and keeps custom hobbies', () => {
    expect(formatHobbies(['Music', 'Swimming', 'Knitting'])).toBe('Swimming, Music, Knitting');
    expect(formatHobbies([])).toBe('');
  });
  it('round-trips', () => {
    const s = 'Swimming, Reading, Praying, Bible Study';
    expect(formatHobbies(parseHobbies(s))).toBe(s);
  });
  it('has 20 options with unique labels', () => {
    expect(HOBBIES).toHaveLength(20);
    expect(new Set(HOBBIES.map(h => h.label)).size).toBe(20);
  });
});

describe('connect tags', () => {
  it('uses the website ids', () => {
    expect(CONNECT_OPTIONS.map(o => o.id)).toEqual([
      'prayer', 'bible', 'meetup', 'worship', 'volunteer', 'chat', 'mentorship', 'family', 'fellowship', 'new-friends',
    ]);
  });
  it('toggles', () => {
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('normalizeSocial', () => {
  it.each([
    ['@christlink', 'instagram.com', 'https://instagram.com/christlink'],
    ['instagram.com/christlinksocial', 'instagram.com', 'https://instagram.com/christlinksocial'],
    ['https://instagram.com/x', 'instagram.com', 'https://instagram.com/x'],
    ['facebook.com/mypage', 'facebook.com', 'https://facebook.com/mypage'],
    ['www.facebook.com/mypage', 'facebook.com', 'https://facebook.com/mypage'],
    ['myhandle', 'tiktok.com', 'https://tiktok.com/@myhandle'],
    ['tiktok.com/@myhandle', 'tiktok.com', 'https://tiktok.com/@myhandle'],
    ['  ', 'tiktok.com', ''],
  ] as const)('%s on %s', (input, site, out) => {
    expect(normalizeSocial(input, site)).toBe(out);
  });
});
