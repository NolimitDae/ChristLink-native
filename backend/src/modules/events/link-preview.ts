import { BadRequestException } from '@nestjs/common';
import { lookup as dnsLookup } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { isIP } from 'net';

/**
 * Reads an event listing on another site (Eventbrite, a church website, Facebook…) so a member can share it without
 * retyping everything: schema.org Event data (JSON-LD) first, OpenGraph tags as the fallback.
 *
 * The URL comes from a member, so the fetch is locked down: http(s) only, public addresses only (checked on the
 * address actually connected to, so a hostname can't be re-pointed at an internal one), few redirects, short timeout,
 * size cap.
 */
export interface EventPreview {
  name?: string;
  description?: string;
  /** As written on the page; may have no time zone (the app reads it as the visitor's local time). */
  start_date?: string;
  end_date?: string;
  format?: 'in_person' | 'online' | 'hybrid';
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  online_url?: string;
  organizer_name?: string;
  image_url?: string;
  ticket_url?: string;
  source_url: string;
}

const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 6_000_000;
const TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 4;

// ── Address checks ───────────────────────────────────────────
/** True for loopback, private, link-local, carrier-NAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === '::' || lower === '::1' ||
      lower.startsWith('fc') || lower.startsWith('fd') || // unique local (Railway's private network)
      lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || // link-local
      lower.startsWith('ff') || // multicast
      lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8:')
    );
  }
  return true;
}

/** Parses and checks a member-supplied link. Throws 400 with a message fit to show. */
export function publicHttpUrl(input: unknown): URL {
  if (typeof input !== 'string' || !input.trim()) throw new BadRequestException('Paste a link to the event.');
  let raw = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('That doesn’t look like a link.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new BadRequestException('Only web links (https) can be used.');
  if (url.username || url.password) throw new BadRequestException('That link can’t be used.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const blockedName = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local') || !host.includes('.');
  if (blockedName || (isIP(host) && isPrivateAddress(host))) throw new BadRequestException('That link can’t be used.');
  if (raw.length > 2000) throw new BadRequestException('That link is too long.');
  return url;
}

/** Same listing, different tracking: drops the fragment, tracking parameters and a trailing slash. */
export function normalizeListingUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|aff$|igshid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return input.trim();
  }
}

// ── Fetch ────────────────────────────────────────────────────
interface Fetched {
  url: URL;
  type: string;
  body: Buffer;
}

function getOnce(url: URL, maxBytes: number, accept: string): Promise<{ status: number; location?: string; type: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      url,
      {
        timeout: TIMEOUT_MS,
        headers: {
          // Listing sites serve their share metadata to link-preview clients
          'User-Agent': 'Mozilla/5.0 (compatible; ChristLinkBot/1.0; +https://christlinksocial.com)',
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.8',
        },
        // The address is validated at connect time, so DNS can't point a public name at a private address
        lookup: (hostname, options, cb) =>
          dnsLookup(hostname, options, (err, address, family) => {
            const list = Array.isArray(address) ? address : [{ address: address as string, family: family as number }];
            if (!err && list.some((a) => isPrivateAddress(a.address))) return cb(new Error('private address'), address as never, family as never);
            cb(err, address as never, family as never);
          }),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: String(res.headers.location), type, body: Buffer.alloc(0) });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy(new Error('too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status, type, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function safeGet(start: URL, maxBytes: number, accept: string): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url, maxBytes, accept);
    if (res.location) {
      url = publicHttpUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`status ${res.status}`);
    return { url, type: res.type, body: res.body };
  }
  throw new Error('too many redirects');
}

export async function fetchListingHtml(url: URL): Promise<{ html: string; finalUrl: URL }> {
  const res = await safeGet(url, MAX_HTML_BYTES, 'text/html,application/xhtml+xml');
  if (!/html|xml/i.test(res.type)) throw new Error('not a page');
  return { html: res.body.toString('utf8'), finalUrl: res.url };
}

/** Downloads a listing's picture as a data URL (for our own storage; listings' image links expire or block hotlinks). */
export async function fetchImageDataUrl(input: string): Promise<string | null> {
  try {
    const res = await safeGet(publicHttpUrl(input), MAX_IMAGE_BYTES, 'image/*');
    const type = res.type.split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type) || res.body.length < 200) return null;
    return `data:${type};base64,${res.body.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── Parse ────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Plain text from a value that may hold HTML: tags out, entities decoded, whitespace tidied, length capped. */
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const out = decodeEntities(v.replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]*>/g, ''))
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out ? out.slice(0, max) : undefined;
}

function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
    const key = attr('property') ?? attr('name');
    const content = attr('content');
    if (!key || !content) continue;
    const k = (key[2] ?? key[3] ?? '').toLowerCase();
    if (k && !out.has(k)) out.set(k, decodeEntities(content[2] ?? content[3] ?? ''));
  }
  return out;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/** Every schema.org node in the page's JSON-LD blocks (arrays and @graph flattened). */
function jsonLdNodes(html: string): Json[] {
  const nodes: Json[] = [];
  const walk = (v: unknown, depth = 0) => {
    if (depth > 6) return;
    if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else if (isObj(v)) {
      nodes.push(v);
      if (v['@graph']) walk(v['@graph'], depth + 1);
    }
  };
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      // some sites ship broken JSON-LD; the OpenGraph tags still apply
    }
  }
  return nodes;
}

/** schema.org Event and its subtypes (MusicEvent, SocialEvent, Festival…). */
const isEventType = (t: unknown): boolean => (Array.isArray(t) ? t.some(isEventType) : typeof t === 'string' && /(event|festival)$/i.test(t));

function httpUrl(v: unknown, base: URL): string | undefined {
  const s = isObj(v) ? (v.url ?? v['@id'] ?? v.contentUrl) : v;
  if (typeof s !== 'string' || !s.trim()) return undefined;
  try {
    const u = new URL(decodeEntities(s.trim()), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function dateText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s && !isNaN(new Date(s).getTime()) ? s : undefined;
}

/** Pulls the event out of a page. `base` is the page's final address (after redirects). */
export function parseEventPage(html: string, base: URL): EventPreview {
  const meta = metaTags(html);
  const ev = jsonLdNodes(html).find((n) => isEventType(n['@type']));
  const out: EventPreview = { source_url: base.toString() };

  if (ev) {
    out.name = text(ev.name, 120);
    out.description = text(ev.description, 2000);
    out.start_date = dateText(ev.startDate);
    out.end_date = dateText(ev.endDate);
    const mode = typeof ev.eventAttendanceMode === 'string' ? ev.eventAttendanceMode : '';
    const places = Array.isArray(ev.location) ? ev.location.filter(isObj) : isObj(ev.location) ? [ev.location] : [];
    const virtual = places.find((p) => /VirtualLocation/i.test(String(p['@type'])));
    const place = places.find((p) => p !== virtual);
    if (typeof ev.location === 'string') out.venue_name = text(ev.location, 200);
    if (place) {
      out.venue_name = text(place.name, 200);
      const addr = first(place.address);
      if (typeof addr === 'string') out.address = text(addr, 300);
      else if (isObj(addr)) {
        out.address = text(addr.streetAddress, 300);
        out.city = text(addr.addressLocality, 100);
        out.state = text(addr.addressRegion, 50);
        out.zip = text(addr.postalCode, 20);
      }
    }
    if (virtual) out.online_url = httpUrl(virtual, base);
    out.format = /Mixed/i.test(mode) || (virtual && place) ? 'hybrid' : /Online/i.test(mode) || (virtual && !place) ? 'online' : 'in_person';
    const org = first(ev.organizer) ?? first(ev.performer);
    out.organizer_name = text(isObj(org) ? org.name : org, 120);
    out.image_url = httpUrl(first(ev.image), base);
    const offer = first(ev.offers);
    out.ticket_url = httpUrl(isObj(offer) ? offer.url : undefined, base);
  }

  // OpenGraph / page-title fallbacks for whatever the structured data didn't give
  out.name ??= text(meta.get('og:title') ?? meta.get('twitter:title') ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 120);
  out.description ??= text(meta.get('og:description') ?? meta.get('description') ?? meta.get('twitter:description'), 2000);
  out.image_url ??= httpUrl(meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('twitter:image'), base);
  out.start_date ??= dateText(meta.get('event:start_time'));
  out.end_date ??= dateText(meta.get('event:end_time'));
  const canonical = httpUrl(meta.get('og:url') ?? /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1], base);
  if (canonical && new URL(canonical).hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')) out.source_url = canonical;
  // The listing itself is where people get tickets or RSVP unless the page names a separate offer link
  out.ticket_url ??= out.source_url;

  for (const k of Object.keys(out) as (keyof EventPreview)[]) if (out[k] === undefined) delete out[k];
  return out;
}
