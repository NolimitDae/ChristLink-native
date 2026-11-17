import { editEventPath, linkHost, priceLabel, repostLinks } from '../../lib/eventHelpers';
import { applyPreview, emptyRepostDraft, repostPayload, tidyLink, validateRepost, type RepostDraft } from '../../lib/repost';

const now = new Date(2026, 10, 17, 12).getTime();
const filled = (patch: Partial<RepostDraft> = {}): RepostDraft => ({
  ...emptyRepostDraft,
  name: 'City Worship Night',
  organizer_name: 'Grace Chapel',
  start: new Date(2026, 11, 5, 19),
  city: 'Dover',
  ...patch,
});

describe('repost form', () => {
  it('needs a name, who hosts it, a start and (in person) a city', () => {
    expect(validateRepost(emptyRepostDraft, { now })).toEqual({ name: 'Add the event’s name', organizer_name: 'Add who is hosting it', start: 'Choose when it starts', city: 'Add the city' });
    expect(validateRepost(filled(), { now })).toEqual({});
    expect(validateRepost(filled({ format: 'online', city: '' }), { now })).toEqual({});
  });

  it('checks dates and links', () => {
    expect(validateRepost(filled({ start: new Date(2026, 10, 10) }), { now })).toEqual({ start: 'That date has already passed' });
    // Editing an event that already started is fine
    expect(validateRepost(filled({ start: new Date(2026, 10, 10) }), { now, editing: true })).toEqual({});
    expect(validateRepost(filled({ end: new Date(2026, 11, 5, 18) }), { now })).toEqual({ end: 'The end must be after the start' });
    expect(validateRepost(filled({ ticket_url: 'not a link', source_url: 'eventbrite.com/e/1' }), { now })).toEqual({ ticket_url: 'That doesn’t look like a link' });
  });

  it('tidies links', () => {
    expect(tidyLink(' eventbrite.com/e/1 ')).toBe('https://eventbrite.com/e/1');
    expect(tidyLink('http://church.org')).toBe('http://church.org');
    expect(tidyLink('')).toBe('');
    expect(tidyLink('hello')).toBeNull();
    expect(tidyLink('javascript:alert(1)')).toBeNull();
  });

  it('fills from a listing without wiping what the page didn’t give', () => {
    const typed = filled({ description: 'My note', organizer_name: 'Typed host' });
    const next = applyPreview(typed, {
      name: 'Winter Retreat', start_date: '2026-12-12T09:00:00-05:00', end_date: 'nonsense', format: 'hybrid', city: 'Lewes',
      source_url: 'https://church.org/retreat', ticket_url: 'https://church.org/retreat', cover_url: 'https://media/x.webp',
    });
    expect(next).toMatchObject({ name: 'Winter Retreat', organizer_name: 'Typed host', description: 'My note', format: 'hybrid', city: 'Lewes', cover_url: 'https://media/x.webp', source_url: 'https://church.org/retreat' });
    expect(next.start?.toISOString()).toBe('2026-12-12T14:00:00.000Z');
    expect(next.end).toBeNull();
  });

  it('builds the request: empty text is null, place fields follow the format, links get https', () => {
    const body = repostPayload(filled({ format: 'online', venue_name: 'Hall', online_url: 'zoom.us/j/1', ticket_url: 'church.org/rsvp', description: '  ' }));
    expect(body).toMatchObject({ name: 'City Worship Night', format: 'online', venue_name: null, city: null, online_url: 'https://zoom.us/j/1', ticket_url: 'https://church.org/rsvp', source_url: null, description: null, end_date: null });
    expect(repostPayload(filled({ online_url: 'zoom.us/j/1' })).online_url).toBeNull();
  });
});

describe('repost display helpers', () => {
  it('cards say Repost instead of a price', () => {
    expect(priceLabel({ is_paid: false, ticket_types: [], is_repost: true })).toBe('Repost');
    expect(priceLabel({ is_paid: false, ticket_types: [] })).toBe('Free');
  });

  it('picks the tickets link and shows the original only when it is a different page', () => {
    expect(repostLinks({ source_url: 'https://a.org/e', ticket_url: 'https://tix.com/1' })).toEqual({ tickets: 'https://tix.com/1', original: 'https://a.org/e' });
    expect(repostLinks({ source_url: 'https://a.org/e', ticket_url: 'https://a.org/e' })).toEqual({ tickets: 'https://a.org/e', original: null });
    expect(repostLinks({ source_url: 'https://a.org/e', ticket_url: null })).toEqual({ tickets: 'https://a.org/e', original: null });
    expect(repostLinks({ source_url: null, ticket_url: null })).toEqual({ tickets: null, original: null });
  });

  it('names the site a link goes to and routes edit to the right form', () => {
    expect(linkHost('https://www.Eventbrite.com/e/123?x=1')).toBe('eventbrite.com');
    expect(linkHost(null)).toBe('');
    expect(editEventPath({ id: 'e1', is_repost: true })).toBe('/event/repost?id=e1');
    expect(editEventPath({ id: 'e1' })).toBe('/event/create?id=e1');
  });
});
