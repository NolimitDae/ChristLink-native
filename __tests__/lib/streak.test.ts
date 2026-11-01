import { currentStreak, dayKey, recordDay, streakLabel, weekDots } from '../../lib/streak';

const d = (day: number, month = 10) => new Date(2026, month, day, 12);

describe('verse streak', () => {
  it('records each day once, in order, and keeps the last 60', () => {
    expect(recordDay(['2026-11-02'], d(2))).toEqual(['2026-11-02']);
    expect(recordDay(['2026-11-03'], d(2))).toEqual(['2026-11-02', '2026-11-03']);
    const many = Array.from({ length: 60 }, (_, i) => dayKey(new Date(2026, 8, i + 1)));
    const next = recordDay(many, d(20));
    expect(next).toHaveLength(60);
    expect(next[59]).toBe('2026-11-20');
  });

  it('counts days in a row through yesterday and across the clock change', () => {
    const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
    expect(currentStreak(days, d(2))).toBe(4);
    expect(currentStreak(days, d(3))).toBe(4);
    expect(currentStreak(days, d(4))).toBe(0);
  });

  it('marks this week Sunday to Saturday', () => {
    const dots = weekDots(['2026-11-01', '2026-11-03'], d(3));
    expect(dots.map(x => x.label).join('')).toBe('SMTWTFS');
    expect(dots.map(x => x.done)).toEqual([true, false, true, false, false, false, false]);
    expect(dots.findIndex(x => x.isToday)).toBe(2);
  });

  it('labels gently', () => {
    expect(streakLabel(1, 1)).toBe('Day 1 · new verse tomorrow');
    expect(streakLabel(1, 3)).toBe('3 days this week');
    expect(streakLabel(4, 4)).toBe('4 days in a row');
    expect(streakLabel(7, 7)).toBe('Perfect week');
  });
});
