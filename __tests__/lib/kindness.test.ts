import { needsKindnessCheck } from '../../lib/kindness';

describe('kindness nudge', () => {
  it('flags insults, profanity, threats and shouting', () => {
    for (const text of ['you are an idiot', 'Shut up already', 'what the fuuuck', 'kys', 'You will burn in hell', 'I HATE HOW YOU ALWAYS DO THIS TO PEOPLE']) {
      expect(needsKindnessCheck(text)).toBe(true);
    }
  });
  it('leaves ordinary faith posts alone', () => {
    for (const text of [
      'Please pray for my brother as he starts a new job',
      'Praise God! The surgery went well.',
      'The fool says in his heart, there is no God (Psalm 14:1)',
      'Jesus descended into hell and rose again',
      'Shiitake mushroom soup for the potluck',
      'AMEN!',
      'Stupidly happy about Sunday',
    ]) {
      expect(needsKindnessCheck(text)).toBe(false);
    }
  });
});
