// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Suppress logger output in tests
jest.mock('../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock constants to avoid undefined env vars
jest.mock('../../lib/constants', () => ({
  API_BASE: 'https://api.test',
  API_TIMEOUT_MS: 5000,
  API_MAX_RETRIES: 0, // no retries in unit tests
  SUPABASE_URL: '',
  SUPABASE_ANON: '',
  STRIPE_PK: '',
  SENTRY_DSN: '',
  COLORS: { dark: {}, light: {} },
  EVENT_TYPES: [],
  EVENT_FORMATS: [],
  AGE_GROUPS: [],
  AVATAR_COLORS: [],
}));

import { getEvents, getEvent } from '../../lib/api';

describe('getEvents', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    await getEvents({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.test/api/events');
  });

  it('appends query params correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    await getEvents({ type: 'Worship', limit: 10 });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('type=Worship');
    expect(url).toContain('limit=10');
  });

  it('omits type param when type is "All"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    await getEvents({ type: 'All' });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).not.toContain('type=');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    await expect(getEvents({})).rejects.toThrow('Not found');
  });
});

describe('getEvent', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('calls /api/events/:id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'ev-1', name: 'Test Event', format: 'in_person', is_paid: false, status: 'published', created_at: '' }),
    });

    const event = await getEvent('ev-1');
    expect(event.id).toBe('ev-1');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.test/api/events/ev-1');
  });
});
