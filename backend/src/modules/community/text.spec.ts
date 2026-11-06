import { BadRequestException } from '@nestjs/common';
import { clampInt, isUuid, sanitizeText } from './text';
import { pickProfileUpdates } from '../profiles/profiles.service';
import { ticketActivityText } from '../admin/admin.service';

describe('social helpers', () => {
  it('sanitizeText strips tags and trims like server.js', () => {
    expect(sanitizeText('  <b>Hi</b> <script>x</script> ')).toBe('Hi x');
    expect(sanitizeText(42)).toBe('');
  });

  it('clampInt matches server.js parseInt/min/max', () => {
    expect(clampInt(undefined, 30, 1, 100)).toBe(30);
    expect(clampInt('500', 30, 1, 100)).toBe(100);
    expect(clampInt('-5', 30, 1, 100)).toBe(1);
    expect(clampInt('abc', 0, 0, 1e9)).toBe(0);
  });

  it('isUuid', () => {
    expect(isUuid('2b1c3f9e-1d2a-4f5b-9c8d-0123456789ab')).toBe(true);
    expect(isUuid('nope')).toBe(false);
  });

  it('pickProfileUpdates keeps only editable fields and validates types', () => {
    expect(
      pickProfileUpdates({ full_name: 'A', role: 'admin', identity_verified: true, email: 'x@y', bio: null, connect_tags: ['a', 3] }),
    ).toEqual({ full_name: 'A', bio: null, connect_tags: ['a'] });
    expect(pickProfileUpdates({ connect_tags: 'x' })).toEqual({ connect_tags: [] });
    expect(() => pickProfileUpdates({ city: 5 })).toThrow(BadRequestException);
  });

  it('ticketActivityText pluralises', () => {
    expect(ticketActivityText(null, 1, 'Gala')).toBe('Attendee bought 1 ticket for "Gala"');
    expect(ticketActivityText('Ann', 2, 'Gala')).toBe('Ann bought 2 tickets for "Gala"');
  });
});
