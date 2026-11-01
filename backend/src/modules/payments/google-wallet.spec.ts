import { createVerify, generateKeyPairSync } from 'crypto';
import { eventTicketObject, parseServiceAccount, saveUrl, upsertPass, type GoogleWalletTicket } from './google-wallet';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const sa = { client_email: 'wallet@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const ticket: GoogleWalletTicket = {
  ticketId: '11111111-1111-4111-8111-111111111111', eventId: '22222222-2222-4222-8222-222222222222', shortCode: 'GSP-7Q4K',
  eventName: 'Gospel Choir Concert', venue: 'Fox Theatre', address: 'Atlanta, GA', start: new Date('2026-11-21T00:00:00Z'),
  end: null, ticketType: 'General admission', quantity: 2, holder: 'Jordan Ellis',
};

describe('Google Wallet', () => {
  it('reads the base64 service-account JSON and rejects junk', () => {
    expect(parseServiceAccount(Buffer.from(JSON.stringify({ ...sa, project_id: 'p' })).toString('base64'))).toEqual(sa);
    expect(parseServiceAccount('not-json')).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });

  it('builds a short, verifiable save link that names only the object', () => {
    const url = saveUrl(sa, '3388000000012345', ticket.ticketId, 1_700_000_000_000);
    expect(url.length).toBeLessThan(1800);
    const jwt = url.replace('https://pay.google.com/gp/v/save/', '');
    const [h, b, s] = jwt.split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toEqual({
      iss: sa.client_email, aud: 'google', typ: 'savetowallet', iat: 1_700_000_000, origins: [],
      payload: { eventTicketObjects: [{ id: `3388000000012345.ticket-${ticket.ticketId}` }] },
    });
  });

  it('uses the same QR message as the Apple pass', () => {
    const obj = eventTicketObject('3388', ticket);
    expect(JSON.parse(obj.barcode.value)).toEqual({ ticketId: ticket.ticketId, code: 'GSP-7Q4K', eventId: ticket.eventId });
    expect(obj.ticketType.defaultValue.value).toBe('General admission × 2');
  });

  it('inserts class and object, updating when they already exist', async () => {
    const calls: string[] = [];
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url.replace('https://walletobjects.googleapis.com/walletobjects/v1', '')}`);
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tok' }));
      if (init?.method === 'POST' && url.endsWith('eventTicketClass')) return new Response('exists', { status: 409 });
      return new Response('{}');
    }) as unknown as typeof fetch;
    await upsertPass(sa, '3388', ticket, fetchFn);
    expect(calls).toEqual([
      'POST https://oauth2.googleapis.com/token',
      'POST /eventTicketClass',
      `PATCH /eventTicketClass/3388.event-${ticket.eventId}`,
      'POST /eventTicketObject',
    ]);
  });
});
