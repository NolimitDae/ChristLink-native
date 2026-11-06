import { legacyHashRoute } from '../../lib/legacyLinks';

describe('legacyHashRoute (old website links)', () => {
  const id = '9f0c2a4e-1b2c-4d5e-8f90-123456789abc';
  it('maps detail links to real paths', () => {
    expect(legacyHashRoute(`#event/${id}`)).toBe(`/event/${id}`);
    expect(legacyHashRoute(`#forum/${id}`)).toBe(`/event/${id}/forum`);
    expect(legacyHashRoute(`#user/${id}`)).toBe(`/user/${id}`);
  });
  it('maps page links', () => {
    expect(legacyHashRoute('#home')).toBe('/');
    expect(legacyHashRoute('#browse')).toBe('/explore');
    expect(legacyHashRoute('#community')).toBe('/community');
    expect(legacyHashRoute('#profile')).toBe('/profile');
  });
  it('ignores anything else', () => {
    expect(legacyHashRoute('')).toBeNull();
    expect(legacyHashRoute('#')).toBeNull();
    expect(legacyHashRoute('#settings')).toBeNull();
    expect(legacyHashRoute('#event/')).toBeNull();
    expect(legacyHashRoute('#event/../../admin')).toBeNull();
    expect(legacyHashRoute('#church/abc')).toBeNull();
  });
});
