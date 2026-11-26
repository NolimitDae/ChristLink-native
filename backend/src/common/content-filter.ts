import { BadRequestException } from '@nestjs/common';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

/**
 * Blocks profanity, slurs and explicit sexual words in anything members post (App Store Guideline 1.2 asks for a way
 * to filter objectionable content, as well as reporting and blocking). `obscenity` catches disguised spellings
 * ("f.u.c.k", "sh1t"). Words that appear in Bible quotes, music, names or honest prayer requests are left out so they
 * aren't blocked: the report button and moderation queue still cover misuse of them.
 */
const ALLOWED = new Set([
  // King James wording and Bible stories: "the cock crew", "kick against the pricks", "a bastard shall not…"
  'ass', 'bastard', 'whore', 'piss', 'cock', 'prick',
  // Prayer requests about abuse, addiction or health, and medical words
  'sex', 'rape', 'incest', 'porn', 'masturbate', 'penis', 'vagina', 'anus', 'anal', 'semen', 'ejaculate',
  // Names, music and history: "Pastor Hooker", "Dick", scat singing, "Negro spirituals"
  'hooker', 'dick', 'scat', 'negro',
]);

const built = englishDataset.removePhrasesIf((p) => ALLOWED.has(p.metadata?.originalWord ?? '')).build();
const matcher = new RegExpMatcher({
  ...built,
  // "trafficking" reads as a disguised swear word once the spelling transformers run
  whitelistedTerms: [...built.whitelistedTerms, 'trafficking', 'trafficked', 'traffick'],
  ...englishRecommendedTransformers,
});

export const OBJECTIONABLE_MESSAGE = 'This includes language that isn’t allowed on Christ Link Social. Please edit it and try again.';

/** True when the text has a blocked word. */
export function isObjectionable(text: unknown): boolean {
  return typeof text === 'string' && text.length > 0 && matcher.hasMatch(text);
}

/** Throws 400 when any of the values has a blocked word (strings and arrays of strings are checked). */
export function assertAllowed(...values: unknown[]) {
  for (const v of values) {
    const list = Array.isArray(v) ? v : [v];
    if (list.some(isObjectionable)) throw new BadRequestException(OBJECTIONABLE_MESSAGE);
  }
}
