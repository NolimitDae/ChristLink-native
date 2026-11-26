import { BadRequestException } from '@nestjs/common';
import { assertAllowed, isObjectionable } from './content-filter';

describe('content filter', () => {
  it('blocks profanity, slurs and explicit words, including disguised spellings', () => {
    for (const t of ['what the fuck', 'this is sh1t', 'fuuuuck this', 'you b!tch', 'shiiiit', 'nice tits', 'go watch hentai']) {
      expect(isObjectionable(t)).toBe(true);
    }
  });

  it('allows Bible quotes, prayer requests, names and everyday words', () => {
    for (const t of [
      'And immediately the cock crew. (Matthew 26:74)',
      'It is hard for thee to kick against the pricks.',
      'Thou shalt not covet thy neighbour’s ass.',
      'Please pray for me as I fight my porn addiction',
      'Praying for survivors of rape and sex trafficking',
      'Pastor Hooker is preaching on Sunday',
      'An evening of Negro spirituals and gospel hymns',
      'Bible class, assembly, Scunthorpe, analysis, therapist, cocktail-free mixer',
      'Mom’s surgery on her penis… no wait, her pancreas, is Tuesday',
    ]) {
      expect(isObjectionable(t)).toBe(false);
    }
  });

  it('assertAllowed checks strings and lists and ignores other values', () => {
    expect(() => assertAllowed('hello', ['fine', 'words'], null, 3)).not.toThrow();
    expect(() => assertAllowed('ok', ['still ok', 'oh shit'])).toThrow(BadRequestException);
  });
});
