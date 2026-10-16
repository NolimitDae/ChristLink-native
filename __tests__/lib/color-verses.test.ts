import { gradientStops, readableOn, solidColor } from '../../lib/color';
import { BUNDLED_VERSES, bundledVerseOfTheDay } from '../../lib/verses';
import { palettes } from '../../lib/theme';

describe('avatar colors from the web app', () => {
  it('turns CSS gradients into something React Native can render', () => {
    const css = 'linear-gradient(135deg,#059669,#064E3B)';
    expect(solidColor(css, '#000')).toBe('#059669');
    expect(gradientStops(css)).toEqual(['#059669', '#064E3B']);
  });
  it('passes through solid colors and falls back on junk', () => {
    expect(solidColor('#C9A84C', '#000')).toBe('#C9A84C');
    expect(solidColor('rgba(1,2,3,0.5)', '#000')).toBe('rgba(1,2,3,0.5)');
    expect(solidColor('var(--gold)', '#111')).toBe('#111');
    expect(solidColor(null, '#111')).toBe('#111');
    expect(gradientStops('#fff')).toBeNull();
  });
  it('picks readable text', () => {
    expect(readableOn('#C9A84C')).toBe('#14110E');
    expect(readableOn('#064E3B')).toBe('#F6EFE3');
  });
});

describe('design tokens', () => {
  it('uses the darker gold for text on light backgrounds and dark text on gold buttons', () => {
    expect(palettes.light.goldText).toBe('#8A6A1F');
    expect(palettes.light.onGold).toBe('#1C160E');
    expect(palettes.dark.onGold).toBe('#14110E');
  });
});

describe('verse of the day fallback', () => {
  it('is stable for a given day and rotates daily', () => {
    const a = bundledVerseOfTheDay(null, new Date(2026, 9, 15, 8));
    const b = bundledVerseOfTheDay(null, new Date(2026, 9, 15, 22));
    const c = bundledVerseOfTheDay(null, new Date(2026, 9, 16, 8));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('matches the theme of an upcoming event when possible', () => {
    const v = bundledVerseOfTheDay('Prayer', new Date(2026, 9, 15));
    expect(v.themes).toContain('prayer');
    expect(BUNDLED_VERSES.length).toBeGreaterThanOrEqual(30);
  });
});
