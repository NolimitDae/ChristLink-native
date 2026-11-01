/**
 * Pre-post nudge (Instagram-style comment warnings): words that usually mean a post or reply will hurt someone.
 * It never blocks; the person can edit or post anyway. Reports and the admin queue stay the real moderation.
 */
const HARSH = [
  /\b(idiot|moron|stupid|dumb|loser|pathetic|worthless|ugly|retard(ed)?|clown)s?\b/i,
  /\b(f+u+c+k+\w*|sh[i1]t\w*|b[i1]tch\w*|bastard|a+ss+hole|slut|whore|dumbass)\b/i,
  /\bshut\s+up\b/i,
  /\b(i\s+hate\s+you|nobody\s+(likes|cares\s+about)\s+you)\b/i,
  /\b(kill\s+yourself|kys)\b/i,
  /\b(go\s+to|burn\s+in|going\s+to)\s+hell\b/i,
];

/** Mostly capital letters over a long stretch reads as shouting. */
function isShouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8;
}

export function needsKindnessCheck(text: string): boolean {
  return HARSH.some(re => re.test(text)) || isShouting(text);
}

export const KINDNESS_PROMPT = {
  title: 'Is this kind and true?',
  body: 'Your words may hurt someone. Take a moment to reread before you share. “Let your speech always be gracious.” — Colossians 4:6',
  edit: 'Edit',
  post: 'Post anyway',
};
