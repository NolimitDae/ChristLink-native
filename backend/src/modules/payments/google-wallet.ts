import { createSign } from 'crypto';

/** Service account fields we use from the downloaded Google Cloud JSON key. */
export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

export interface GoogleWalletTicket {
  ticketId: string;
  eventId: string;
  shortCode: string;
  eventName: string;
  venue: string;
  address: string | null;
  start: Date | null;
  end: Date | null;
  ticketType: string;
  quantity: number;
  holder: string | null;
}

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const BG = '#0A0A0F';

const b64url = (v: string | Buffer) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : v).toString('base64url');

/** RS256 JWT signed with the service account key. */
export function signJwt(claims: Record<string, unknown>, privateKey: string): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

/** Decodes the base64 service-account JSON from GOOGLE_WALLET_KEY_JSON_BASE64; null if missing or malformed. */
export function parseServiceAccount(base64: string | undefined): GoogleServiceAccount | null {
  if (!base64) return null;
  try {
    const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as Partial<GoogleServiceAccount>;
    return json.client_email && json.private_key ? { client_email: json.client_email, private_key: json.private_key } : null;
  } catch {
    return null;
  }
}

const text = (value: string) => ({ defaultValue: { language: 'en-US', value } });

/** Ids may only hold letters, digits, '.', '_' and '-'; they are `<issuerId>.<suffix>`. */
export const classId = (issuerId: string, eventId: string) => `${issuerId}.event-${eventId}`;
export const objectId = (issuerId: string, ticketId: string) => `${issuerId}.ticket-${ticketId}`;

export function eventTicketClass(issuerId: string, t: GoogleWalletTicket) {
  return {
    id: classId(issuerId, t.eventId),
    issuerName: 'Christ Link',
    reviewStatus: 'UNDER_REVIEW',
    eventName: text(t.eventName),
    venue: { name: text(t.venue), address: text(t.address || t.venue) },
    ...(t.start ? { dateTime: { start: t.start.toISOString(), ...(t.end ? { end: t.end.toISOString() } : {}) } } : {}),
    hexBackgroundColor: BG,
  };
}

export function eventTicketObject(issuerId: string, t: GoogleWalletTicket) {
  return {
    id: objectId(issuerId, t.ticketId),
    classId: classId(issuerId, t.eventId),
    state: 'ACTIVE',
    // Same QR message as the Apple pass, so the door scanner treats both alike
    barcode: { type: 'QR_CODE', value: JSON.stringify({ ticketId: t.ticketId, code: t.shortCode, eventId: t.eventId }), alternateText: t.shortCode },
    ticketType: text(`${t.ticketType}${t.quantity > 1 ? ` × ${t.quantity}` : ''}`),
    ...(t.holder ? { ticketHolderName: t.holder } : {}),
    ticketNumber: t.shortCode,
    hexBackgroundColor: BG,
  };
}

/**
 * Google's "skinny JWT": the class and object are created through the REST API first, so the save link only names the
 * object and stays well under the ~1800-character URL limit some browsers enforce.
 */
export function saveUrl(sa: GoogleServiceAccount, issuerId: string, ticketId: string, now = Date.now()): string {
  const jwt = signJwt(
    {
      iss: sa.client_email,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(now / 1000),
      origins: [],
      payload: { eventTicketObjects: [{ id: objectId(issuerId, ticketId) }] },
    },
    sa.private_key,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

async function accessToken(sa: GoogleServiceAccount, fetchFn: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, sa.private_key);
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google auth failed: ${json.error_description ?? res.status}`);
  return json.access_token;
}

/** Creates (or refreshes) the event class and the ticket object. 409 on insert means it exists, so it is updated. */
export async function upsertPass(sa: GoogleServiceAccount, issuerId: string, t: GoogleWalletTicket, fetchFn: typeof fetch = fetch) {
  const token = await accessToken(sa, fetchFn);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const put = async (kind: 'eventTicketClass' | 'eventTicketObject', resource: { id: string }) => {
    const insert = await fetchFn(`${WALLET_API}/${kind}`, { method: 'POST', headers, body: JSON.stringify(resource) });
    if (insert.ok) return;
    if (insert.status !== 409) throw new Error(`Google Wallet ${kind} insert failed: ${insert.status} ${await insert.text()}`);
    const update = await fetchFn(`${WALLET_API}/${kind}/${encodeURIComponent(resource.id)}`, { method: 'PATCH', headers, body: JSON.stringify(resource) });
    if (!update.ok) throw new Error(`Google Wallet ${kind} update failed: ${update.status} ${await update.text()}`);
  };
  await put('eventTicketClass', eventTicketClass(issuerId, t));
  await put('eventTicketObject', eventTicketObject(issuerId, t));
}
