import { BadRequestException } from '@nestjs/common';
import { decodeEntities, isPrivateAddress, normalizeListingUrl, parseEventPage, publicHttpUrl } from './link-preview';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe('link preview: which links may be fetched', () => {
  it('accepts ordinary web links and adds https when missing', () => {
    expect(publicHttpUrl('https://www.eventbrite.com/e/worship-night-123').hostname).toBe('www.eventbrite.com');
    expect(publicHttpUrl('  gracechurch.org/events/retreat ').toString()).toBe('https://gracechurch.org/events/retreat');
  });

  it.each([
    'http://localhost:4000/admin',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fd12:3456::1]/',
    'http://api.railway.internal/',
    'http://intranet/',
    'https://user:pass@example.com/',
    'ftp://example.com/file',
    'javascript:alert(1)',
    '',
  ])('refuses %s', (link) => expect(() => publicHttpUrl(link)).toThrow(BadRequestException));

  it('knows private address ranges', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '104.18.2.3', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });

  it('treats the same listing with different tracking as one link', () => {
    expect(normalizeListingUrl('https://www.Eventbrite.com/e/worship-123/?utm_source=ig&aff=x#tickets')).toBe('https://eventbrite.com/e/worship-123');
    expect(normalizeListingUrl('https://eventbrite.com/e/worship-123')).toBe('https://eventbrite.com/e/worship-123');
    expect(normalizeListingUrl('https://site.org/events?id=7&fbclid=abc')).toBe('https://site.org/events?id=7');
  });
});

describe('link preview: reading the event from a page', () => {
  const base = new URL('https://www.eventbrite.com/e/city-worship-night-tickets-123?aff=share');

  it('reads schema.org Event data (the format ticketing sites publish)', () => {
    const html = page(`
      <title>City Worship Night Tickets | Eventbrite</title>
      <meta property="og:title" content="OG title (not used)" />
      <meta property="og:url" content="https://www.eventbrite.com/e/city-worship-night-tickets-123" />
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: 'City Worship Night &amp; Prayer',
        description: '<p>An evening of worship.</p><p>Doors at 6.</p>',
        startDate: '2026-12-05T19:00:00-05:00',
        endDate: '2026-12-05T21:30:00-05:00',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: 'Grace Chapel', address: { '@type': 'PostalAddress', streetAddress: '12 Main St', addressLocality: 'Dover', addressRegion: 'DE', postalCode: '19901' } },
        image: ['/img/flyer.jpg'],
        organizer: { '@type': 'Organization', name: 'Grace Chapel Worship' },
        offers: [{ '@type': 'Offer', url: 'https://www.eventbrite.com/e/123/tickets', price: '10.00' }],
      })}</script>`);
    expect(parseEventPage(html, base)).toEqual({
      name: 'City Worship Night & Prayer',
      description: 'An evening of worship.\nDoors at 6.',
      start_date: '2026-12-05T19:00:00-05:00',
      end_date: '2026-12-05T21:30:00-05:00',
      format: 'in_person',
      venue_name: 'Grace Chapel',
      address: '12 Main St',
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      organizer_name: 'Grace Chapel Worship',
      image_url: 'https://www.eventbrite.com/img/flyer.jpg',
      ticket_url: 'https://www.eventbrite.com/e/123/tickets',
      source_url: 'https://www.eventbrite.com/e/city-worship-night-tickets-123',
    });
  });

  it('finds the event inside @graph and recognises online events', () => {
    const html = page(`<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'WebSite', name: 'A church' },
        { '@type': ['Event'], name: 'Online Bible Study', startDate: '2026-12-01T19:00', location: { '@type': 'VirtualLocation', url: 'https://zoom.us/j/1' }, eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode' },
      ],
    })}</script>`);
    const out = parseEventPage(html, new URL('https://church.org/study'));
    expect(out).toMatchObject({ name: 'Online Bible Study', format: 'online', online_url: 'https://zoom.us/j/1', start_date: '2026-12-01T19:00', source_url: 'https://church.org/study', ticket_url: 'https://church.org/study' });
  });

  it('falls back to OpenGraph tags and the page title, and survives broken JSON-LD', () => {
    const html = page(`
      <title>Youth Retreat &ndash; Hope Church</title>
      <meta name="description" content="Three days away for grades 6&ndash;12." />
      <meta content="https://cdn.hope.org/retreat.png" property="og:image" />
      <script type="application/ld+json">{ not json </script>`);
    expect(parseEventPage(html, new URL('https://hope.org/retreat'))).toEqual({
      name: 'Youth Retreat – Hope Church',
      description: 'Three days away for grades 6–12.',
      image_url: 'https://cdn.hope.org/retreat.png',
      source_url: 'https://hope.org/retreat',
      ticket_url: 'https://hope.org/retreat',
    });
  });

  it('ignores a canonical link that points at another site, bad dates and script-like links', () => {
    const html = page(`
      <meta property="og:url" content="https://evil.example/phish" />
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'X Night', startDate: 'soon', image: 'javascript:alert(1)', offers: { url: 'data:text/html,hi' } })}</script>`);
    const out = parseEventPage(html, new URL('https://hope.org/x'));
    expect(out).toEqual({ name: 'X Night', format: 'in_person', source_url: 'https://hope.org/x', ticket_url: 'https://hope.org/x' });
  });

  it('decodes entities', () => expect(decodeEntities('Tom &amp; Ann&#39;s &#x2014; caf&eacute;')).toBe('Tom & Ann\'s — caf&eacute;'));
});
