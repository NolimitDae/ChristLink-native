const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../lib/constants', () => ({
  API_BASE: 'https://api.test',
  API_TIMEOUT_MS: 5000,
  API_MAX_RETRIES: 1,
}));

import {
  ApiError,
  createPaymentIntent,
  getCommunityPosts,
  getEvent,
  getEvents,
  getMyTickets,
  normalizeEvent,
  normalizePost,
  verifyTicket,
} from '../../lib/api';

function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  mockFetch.mockReset();
  jest.useRealTimers();
});

describe('getEvents', () => {
  it('calls the events endpoint with no query by default', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { events: [] }));
    await getEvents({});
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.test/api/events');
  });

  it('builds query params and omits type "All"', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { events: [] }));
    await getEvents({ type: 'All', q: 'youth night', limit: 10, is_paid: false });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('type=');
    expect(url).toContain('q=youth+night');
    expect(url).toContain('limit=10');
    expect(url).toContain('is_paid=false');
  });

  it('normalizes the web field names', async () => {
    mockFetch.mockResolvedValueOnce(
      respond(200, {
        events: [
          {
            id: 'e1',
            name: 'Worship Night',
            host_avatar: 'https://img/host.jpg',
            confirmed_rsvps: 12,
            ticket_types: [{ id: 't1', price_cents: 1500, sold: 3 }],
          },
        ],
      }),
    );
    const { events } = await getEvents();
    expect(events[0].host_avatar_url).toBe('https://img/host.jpg');
    expect(events[0].going_count).toBe(12);
    expect(events[0].ticket_types[0].tickets_sold).toBe(3);
    expect(events[0].format).toBe('in_person');
  });

  it('throws ApiError with the server message', async () => {
    mockFetch.mockResolvedValueOnce(respond(404, { error: 'Not found' }));
    await expect(getEvents({})).rejects.toThrow('Not found');
  });

  it('retries idempotent GETs on 5xx', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValueOnce(respond(503, { error: 'busy' })).mockResolvedValueOnce(respond(200, { events: [] }));
    const p = getEvents();
    await jest.advanceTimersByTimeAsync(1100);
    await expect(p).resolves.toEqual({ events: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('getEvent', () => {
  it('calls /api/events/:id and passes the token when given', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { id: 'ev-1', name: 'Test', is_paid: false, status: 'published' }));
    const event = await getEvent('ev-1', 'tok');
    expect(event.id).toBe('ev-1');
    expect(event.going_count).toBe(0);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.test/api/events/ev-1');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });
});

describe('payments', () => {
  it('never retries a payment intent request (no double charge)', async () => {
    mockFetch.mockResolvedValueOnce(respond(500, { error: 'Stripe error' }));
    await expect(createPaymentIntent({ eventId: 'e1', qty: 1 }, 'tok')).rejects.toBeInstanceOf(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ eventId: 'e1', qty: 1 });
  });

  it('surfaces a declined card error message from the server', async () => {
    mockFetch.mockResolvedValueOnce(respond(402, { error: 'Your card was declined.' }));
    await expect(createPaymentIntent({ eventId: 'e1', qty: 1 }, 'tok')).rejects.toThrow('Your card was declined.');
  });

  it('filters pending and failed tickets from My Tickets', async () => {
    mockFetch.mockResolvedValueOnce(
      respond(200, {
        tickets: [
          { id: 'a', status: 'confirmed', ticket_types: { name: 'VIP' } },
          { id: 'b', status: 'pending' },
          { id: 'c', status: 'failed' },
          { id: 'd', status: 'refunded' },
        ],
      }),
    );
    const { tickets } = await getMyTickets('tok');
    expect(tickets.map(t => t.id)).toEqual(['a', 'd']);
    expect(tickets[0].ticket_type_name).toBe('VIP');
  });

  it('sends the web-compatible check-in payload', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { valid: true }));
    await verifyTicket({ ticketId: 't1', code: 'ABC123', eventId: 'e1' }, 'tok');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ ticketId: 't1', code: 'ABC123', eventId: 'e1' });
  });
});

describe('community posts', () => {
  it('maps body/author_id to content/user_id', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { posts: [{ id: 'p1', author_id: 'u1', body: 'Amen!', amen_count: 2 }] }));
    const { posts } = await getCommunityPosts();
    expect(posts[0]).toMatchObject({ id: 'p1', user_id: 'u1', content: 'Amen!', amen_count: 2, reply_count: 0 });
  });

  it('keeps content when the API already uses it', () => {
    expect(normalizePost({ id: 'p', user_id: 'u', content: 'x' }).content).toBe('x');
  });
});

describe('normalizeEvent', () => {
  it('prefers explicit going_count over rsvp_count', () => {
    expect(normalizeEvent({ id: 'e', going_count: 5, rsvp_count: 2 }).going_count).toBe(5);
    expect(normalizeEvent({ id: 'e', rsvp_count: 2 }).going_count).toBe(2);
  });
});
