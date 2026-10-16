import { buildServeQr, buildTicketQr, parseScan, ticketShortCode } from '../../lib/qr';

describe('ticket QR payloads', () => {
  const ticket = { id: 'aaaa-bbbb-cccc-dddd', event_id: 'ev1', status: 'confirmed', code: null };

  it('matches the web app payload shape so either scanner works', () => {
    expect(JSON.parse(buildTicketQr(ticket))).toEqual({
      ticketId: 'aaaa-bbbb-cccc-dddd',
      eventId: 'ev1',
      code: 'AAAABBBB',
      status: 'confirmed',
    });
  });

  it('prefers the server code', () => {
    expect(ticketShortCode({ id: 'x', code: 'CL-42' })).toBe('CL-42');
  });

  it('round-trips through the parser', () => {
    const parsed = parseScan(buildTicketQr(ticket));
    expect(parsed).toEqual({ kind: 'ticket', data: { ticketId: ticket.id, eventId: 'ev1', code: 'AAAABBBB', status: 'confirmed' } });
  });
});

describe('parseScan', () => {
  it('recognizes volunteer passes', () => {
    expect(parseScan(buildServeQr('ab12cd34'))).toEqual({ kind: 'serve', code: 'ab12cd34' });
  });

  it('accepts a typed short code', () => {
    expect(parseScan(' ab12cd34 ')).toEqual({ kind: 'code', code: 'AB12CD34' });
  });

  it.each(['', '{bad json', '{"foo":1}', 'https://evil.example/?x=1', 'a b'])('rejects %p', raw => {
    expect(parseScan(raw)).toEqual({ kind: 'invalid' });
  });
});
