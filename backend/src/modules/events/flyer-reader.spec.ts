import { flyerToPreview, FlyerReaderService } from './flyer-reader';

const flyer = (patch: Record<string, unknown> = {}) => ({
  is_event_flyer: true, name: ' City <b>Worship</b> Night ', organizer_name: 'Grace Chapel', start_local: '2026-12-05T19:00', end_local: null,
  format: 'in_person' as const, venue_name: 'Grace Chapel', address: '12 Main St', city: 'Dover', state: 'DE', zip: '19901',
  description: 'An evening of worship.', link: 'gracechapel.org/worship',
  ...patch,
});

describe('flyer reading', () => {
  it('turns what the model read into form fields, tidied', () => {
    expect(flyerToPreview(flyer())).toEqual({
      name: 'City Worship Night', organizer_name: 'Grace Chapel', start_date: '2026-12-05T19:00', format: 'in_person', venue_name: 'Grace Chapel',
      address: '12 Main St', city: 'Dover', state: 'DE', zip: '19901', description: 'An evening of worship.', ticket_url: 'https://gracechapel.org/worship',
    });
  });

  it('drops badly formed dates and anything that is not a web link', () => {
    const out = flyerToPreview(flyer({ start_local: 'Dec 5 at 7', end_local: '2026-12-05 21:00', link: 'call 555-0100' }));
    expect(out).not.toHaveProperty('start_date');
    expect(out).not.toHaveProperty('end_date');
    expect(out).not.toHaveProperty('ticket_url');
    expect(flyerToPreview(flyer({ link: 'javascript:alert(1)' }))).not.toHaveProperty('ticket_url');
  });

  it('gives nothing for a picture that is not a flyer', () => {
    expect(flyerToPreview(flyer({ is_event_flyer: false }))).toBeNull();
    expect(flyerToPreview({ is_event_flyer: true, name: null, organizer_name: null, start_local: null, end_local: null, format: null, venue_name: null, address: null, city: null, state: null, zip: null, description: null, link: null })).toBeNull();
  });

  it('is off, and makes no request, without an API key', async () => {
    const before = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const svc = new FlyerReaderService();
    expect(svc.enabled).toBe(false);
    expect(await svc.read(Buffer.from('not an image'))).toBeNull();
    if (before !== undefined) process.env.ANTHROPIC_API_KEY = before;
  });
});
