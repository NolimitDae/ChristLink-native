import { EVENT_TYPES } from './constants';

/** Event types someone can pick as interests (everything but the "All" filter). */
export const INTEREST_TYPES = EVENT_TYPES.filter(type => type !== 'All');

/**
 * Orders category sections: picked interests first (in the order picked), then the rest by how many events they have.
 * Sections keep their own event order.
 */
export function rankByInterest<T extends { type: string; events: unknown[] }>(sections: T[], interests: string[]): T[] {
  const rank = (type: string) => {
    const i = interests.findIndex(x => x.toLowerCase() === type.toLowerCase());
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...sections].sort((a, b) => rank(a.type) - rank(b.type) || b.events.length - a.events.length);
}
