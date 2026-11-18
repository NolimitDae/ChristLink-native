import { REPEAT_CHOICES, REPEAT_CHOICE_LABELS, isRepeatRule, localDay, nextOfEachSeries, repeatEndLabel, repeatSentence, repeatTag, weekOfMonth } from '../../lib/eventRepeat';

describe('repeat labels', () => {
  const tue7pm = new Date(2026, 10, 10, 19, 0); // Tue 10 Nov 2026 (2nd Tuesday)

  it('describes each rule from the first date', () => {
    expect(repeatSentence('weekly', tue7pm)).toBe('Every Tuesday at 7:00 PM');
    expect(repeatSentence('biweekly', tue7pm)).toBe('Every other Tuesday at 7:00 PM');
    expect(repeatSentence('monthly', tue7pm)).toBe('Monthly on the 2nd Tuesday at 7:00 PM');
    expect(repeatSentence('monthly', new Date(2026, 9, 30, 20, 0), false)).toBe('Monthly on the last Friday');
    expect(repeatSentence('monthly', new Date(2026, 10, 24, 19, 0), false)).toBe('Monthly on the 4th Tuesday');
  });

  it('matches the server’s week-of-month rule', () => {
    expect([1, 7, 8, 14, 15, 21, 22, 28, 29, 31].map(weekOfMonth)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('has a label for every choice and short tags', () => {
    expect(REPEAT_CHOICES.every(c => !!REPEAT_CHOICE_LABELS[c])).toBe(true);
    expect(repeatTag('biweekly')).toBe('Every 2 weeks');
    expect(isRepeatRule('weekly')).toBe(true);
    expect(isRepeatRule('none')).toBe(false);
    expect(isRepeatRule(undefined)).toBe(false);
  });

  it('formats the last day and the end label', () => {
    expect(localDay(new Date(2027, 0, 5, 23, 30))).toBe('2027-01-05');
    expect(repeatEndLabel(null)).toBe('No end date');
    expect(repeatEndLabel(new Date(new Date().getFullYear(), 2, 3))).toBe('Until Mar 3');
  });
});

describe('nextOfEachSeries', () => {
  it('keeps one-off events and the first date of each series, counting the rest', () => {
    const { events, more } = nextOfEachSeries([
      { id: 'a1', series_id: 's1' },
      { id: 'x' },
      { id: 'a2', series_id: 's1' },
      { id: 'b1', series_id: 's2' },
      { id: 'a3', series_id: 's1' },
      { id: 'y', series_id: null },
    ]);
    expect(events.map(e => e.id)).toEqual(['a1', 'x', 'b1', 'y']);
    expect(more.get('s1')).toBe(2);
    expect(more.get('s2')).toBeUndefined();
  });
});
