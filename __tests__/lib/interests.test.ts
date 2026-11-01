import { INTEREST_TYPES, rankByInterest } from '../../lib/interests';

describe('interests', () => {
  it('offers every event type except All', () => {
    expect(INTEREST_TYPES).not.toContain('All');
    expect(INTEREST_TYPES).toContain('Worship');
  });
  it('puts picked interests first in picked order, then by size', () => {
    const sections = [
      { type: 'Worship', events: [1, 2, 3] },
      { type: 'Youth', events: [1] },
      { type: 'Retreat', events: [1, 2] },
      { type: 'Concert', events: [1, 2, 3, 4] },
    ];
    expect(rankByInterest(sections, ['youth', 'Retreat']).map(s => s.type)).toEqual(['Youth', 'Retreat', 'Concert', 'Worship']);
    expect(rankByInterest(sections, []).map(s => s.type)).toEqual(['Concert', 'Worship', 'Retreat', 'Youth']);
  });
});
