/**
 * QR payloads. Ticket payloads match the web app exactly so either scanner can check in either ticket:
 * {"ticketId","eventId","code","status"}. Volunteer passes use {"serve": "<code>"}.
 */
export interface TicketQrPayload {
  ticketId: string;
  eventId: string;
  code: string;
  status: string;
}

export type ScanPayload =
  | { kind: 'ticket'; data: TicketQrPayload }
  | { kind: 'serve'; code: string }
  | { kind: 'code'; code: string }
  | { kind: 'invalid' };

export function ticketShortCode(ticket: { id: string; code?: string | null }): string {
  return ticket.code || ticket.id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildTicketQr(ticket: { id: string; event_id: string; code?: string | null; status: string }): string {
  return JSON.stringify({
    ticketId: ticket.id,
    eventId: ticket.event_id,
    code: ticketShortCode(ticket),
    status: ticket.status,
  });
}

export function buildServeQr(code: string): string {
  return JSON.stringify({ serve: code });
}

export function parseScan(raw: string): ScanPayload {
  const text = raw.trim();
  if (!text) return { kind: 'invalid' };
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (typeof obj.serve === 'string' && obj.serve) return { kind: 'serve', code: obj.serve };
      if (typeof obj.ticketId === 'string' && typeof obj.eventId === 'string') {
        return {
          kind: 'ticket',
          data: {
            ticketId: obj.ticketId,
            eventId: obj.eventId,
            code: typeof obj.code === 'string' ? obj.code : '',
            status: typeof obj.status === 'string' ? obj.status : '',
          },
        };
      }
      return { kind: 'invalid' };
    } catch {
      return { kind: 'invalid' };
    }
  }
  if (/^[A-Za-z0-9-]{4,40}$/.test(text)) return { kind: 'code', code: text.toUpperCase() };
  return { kind: 'invalid' };
}
