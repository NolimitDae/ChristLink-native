/** server.js sanitizeText: strip HTML tags (stored XSS) and trim. */
export function sanitizeText(str: unknown): string {
  return typeof str === 'string' ? str.replace(/<[^>]*>/g, '').trim() : '';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects malformed uuids with an error; check first so bad ids read as "not found", not 500. */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Prisma known-request error code (P2002 unique, P2003 foreign key, P2025 not found). */
export const prismaCode = (e: unknown) => (e as { code?: string })?.code;

/** server.js `Math.min(Math.max(parseInt(x) || def, min), max)`. */
export function clampInt(v: unknown, def: number, min: number, max: number): number {
  return Math.min(Math.max(parseInt(String(v), 10) || def, min), max);
}

export const AUTHOR_SELECT = { id: true, full_name: true, avatar_url: true, avatar_color: true } as const;
