/**
 * Web preview mode (EXPO_PUBLIC_DEMO=1, web only; docs/WEB-PREVIEW.md). Answers every /api/* request from sample data
 * kept in memory, signs in a sample account, and on wide screens shows the app inside a phone-sized frame.
 * Never part of the iOS/Android apps: app/_layout.tsx only loads it on web with the flag set.
 */
import React from 'react';
import * as D from './demoData';

type Row = Record<string, unknown>;
type Handler = (m: string[], body: Row, query: URLSearchParams) => unknown;

/** The bits of the browser this file uses (the app's TypeScript config has no DOM types). */
interface BrowserWindow {
  fetch: typeof fetch;
  location: { href: string; pathname: string; search: string };
  self: unknown;
  top: unknown;
  innerWidth: number;
  document: { head: { appendChild(n: unknown): void }; createElement(tag: string): { textContent: string } };
  localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void };
}
const win = (): BrowserWindow | null => ('document' in globalThis ? (globalThis as unknown as BrowserWindow) : null);

const SESSION_KEY = 'cl.session';
const PHONE = { width: 390, height: 844 };
const LATENCY_MS = 180;

const state = {
  events: D.EVENTS.map(e => ({ ...e })),
  posts: D.POSTS.map(p => ({ ...p })),
  prayers: D.PRAYERS.map(p => ({ ...p })),
  rsvps: D.RSVPS.map(r => ({ ...r })),
  tickets: D.TICKETS.map(t => ({ ...t })),
  churches: D.CHURCHES.map(c => ({ ...c })),
  profile: { ...D.PROFILE },
  settings: { user_id: D.ME.id, notification_prefs: {}, hide_rsvps_from_non_friends: false } as Row,
  waitlist: new Map<string, boolean>(),
  following: new Set<string>(),
  amened: new Set<string>(),
};

const findEvent = (id: string) => state.events.find(e => e.id === id);
const nextId = () => `demo-${Math.random().toString(36).slice(2, 10)}`;

function rsvpRow(eventId: string): Row {
  const ev = findEvent(eventId);
  return {
    id: nextId(), event_id: eventId, user_id: D.ME.id, status: 'confirmed', created_at: new Date().toISOString(),
    event_name: ev?.name, event_start_date: ev?.start_date, event_city: ev?.city, event_cover_url: ev?.cover_url,
  };
}

function isFull(ev: Row) {
  return !!ev.max_capacity && Number(ev.confirmed_rsvps ?? 0) >= Number(ev.max_capacity);
}

/** Routes the app calls, by method. Patterns are matched against the path after /api. */
const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/events$/, () => ({ events: state.events })],
  ['GET', /^\/events\/([^/]+)$/, ([id]) => findEvent(id) ?? state.events[0]],
  ['GET', /^\/events\/([^/]+)\/attendees$/, () => ({ attendees: D.ATTENDEES, total: D.ATTENDEES.length })],
  ['GET', /^\/events\/([^/]+)\/forum$/, ([id]) => ({
    posts: [
      { id: 'f1', event_id: id, user_id: D.people.grace.id, content: 'So excited for this! Who wants to carpool from Decatur?', created_at: new Date(Date.now() - 7_200_000).toISOString(), profiles: D.people.grace },
      { id: 'f2', event_id: id, user_id: D.people.daniel.id, content: 'I can drive — I have 3 seats.', created_at: new Date(Date.now() - 3_600_000).toISOString(), profiles: D.people.daniel },
    ],
  })],
  ['GET', /^\/events\/([^/]+)\/waitlist$/, ([id]) => waitlistStatus(id)],
  ['POST', /^\/events\/([^/]+)\/waitlist$/, ([id]) => {
    state.waitlist.set(id, true);
    return waitlistStatus(id);
  }],
  ['DELETE', /^\/events\/([^/]+)\/waitlist$/, ([id]) => {
    state.waitlist.delete(id);
    return { success: true };
  }],
  ['GET', /^\/rsvp\/([^/]+)$/, ([id]) => ({ rsvp: state.rsvps.find(r => r.event_id === id) ?? null })],
  ['POST', /^\/rsvp$/, (_m, body) => {
    const id = String(body.eventId);
    const ev = findEvent(id);
    if (ev && isFull(ev)) throw Object.assign(new Error('Event is at full capacity.'), { status: 400 });
    if (!state.rsvps.some(r => r.event_id === id)) {
      state.rsvps.push(rsvpRow(id));
      if (ev) ev.confirmed_rsvps = Number(ev.confirmed_rsvps ?? 0) + 1;
    }
    return { success: true, rsvp: state.rsvps.find(r => r.event_id === id) };
  }],
  ['DELETE', /^\/rsvp\/([^/]+)$/, ([id]) => {
    const before = state.rsvps.length;
    state.rsvps = state.rsvps.filter(r => r.event_id !== id);
    const ev = findEvent(id);
    if (ev && state.rsvps.length < before) ev.confirmed_rsvps = Math.max(0, Number(ev.confirmed_rsvps ?? 0) - 1);
    return { success: true };
  }],
  ['GET', /^\/my-rsvps$/, () => ({ rsvps: state.rsvps })],
  ['GET', /^\/my-tickets$/, () => ({ tickets: state.tickets })],
  ['GET', /^\/my-events$/, () => ({ events: state.events.slice(0, 3).map(e => ({ ...e, host_id: D.ME.id })) })],
  ['GET', /^\/events\/([^/]+)\/sales$/, ([id]) => ({
    event: findEvent(id), tickets: [], rsvps: [],
    summary: { totalTicketsSold: 52, totalRsvps: Number(findEvent(id)?.confirmed_rsvps ?? 0), grossRevenue: 754000, hostEarnings: 701220 },
  })],
  ['GET', /^\/profile$/, () => state.profile],
  ['PATCH', /^\/profile$/, (_m, body) => Object.assign(state.profile, body)],
  ['GET', /^\/profile\/public\/([^/]+)$/, ([id]) => publicProfile(id)],
  ['GET', /^\/profiles\/([^/]+)\/stats$/, () => ({ eventsHosted: 6, totalAttendees: 1108, isVerified: true })],
  ['GET', /^\/profiles\/([^/]+)$/, ([id]) => {
    const p = Object.values(D.people).find(x => x.id === id);
    return p ? { ...p, bio: 'Following Jesus in Atlanta.', followers_count: 214, following_count: 180, created_at: new Date(2025, 0, 1).toISOString() } : state.profile;
  }],
  ['GET', /^\/community-posts$/, () => ({ posts: state.posts })],
  ['POST', /^\/community-posts$/, (_m, body) => {
    const post = { id: nextId(), author_id: D.ME.id, body: body.content ?? body.body, amen_count: 0, reply_count: 0, created_at: new Date().toISOString(), profiles: { id: D.ME.id, full_name: state.profile.full_name, avatar_color: state.profile.avatar_color } };
    state.posts.unshift(post);
    return post;
  }],
  ['POST', /^\/community-posts\/([^/]+)\/amen$/, ([id]) => {
    const post = state.posts.find(p => p.id === id);
    const on = !state.amened.has(id);
    if (on) state.amened.add(id);
    else state.amened.delete(id);
    if (post) post.amen_count = Number(post.amen_count ?? 0) + (on ? 1 : -1);
    return { amened: on, amen_count: post?.amen_count ?? 0 };
  }],
  ['GET', /^\/community-posts\/([^/]+)\/replies$/, () => ({
    replies: [{ id: 'r1', post_id: 'x', author_id: D.people.ruth.id, body: 'Praise God! 🙏', amen_count: 3, created_at: new Date(Date.now() - 1_800_000).toISOString(), profiles: D.people.ruth }],
  })],
  ['GET', /^\/prayers$/, (_m, _b, q) => {
    const f = q.get('filter') ?? 'all';
    const author = q.get('author');
    if (author) return state.prayers.filter(p => p.author_id === author && (!p.is_anonymous || p.is_mine));
    return state.prayers.filter(p => (f === 'answered' ? p.answered_at : f === 'mine' ? p.is_mine : f === 'friends' ? p.is_friend : f === 'church' ? false : true));
  }],
  ['POST', /^\/prayers$/, (_m, body) => {
    const row = { id: nextId(), body: body.body, is_anonymous: !!body.is_anonymous, created_at: new Date().toISOString(), answered_at: null, testimony: null, prayed_count: 0, has_prayed: false, is_mine: true, is_friend: false, church_id: null, author_id: D.ME.id, author_name: state.profile.full_name, author_avatar_color: state.profile.avatar_color };
    state.prayers.unshift(row);
    return row;
  }],
  ['POST', /^\/prayers\/([^/]+)\/pray$/, ([id]) => {
    const p = state.prayers.find(x => x.id === id);
    if (p && !p.has_prayed) Object.assign(p, { has_prayed: true, prayed_count: Number(p.prayed_count) + 1 });
    return { count: p?.prayed_count ?? 1 };
  }],
  ['POST', /^\/prayers\/([^/]+)\/answer$/, ([id], body) => {
    const p = state.prayers.find(x => x.id === id);
    if (p) Object.assign(p, { answered_at: new Date().toISOString(), testimony: body.testimony });
    return { post_id: nextId() };
  }],
  ['DELETE', /^\/prayers\/([^/]+)$/, ([id]) => {
    state.prayers = state.prayers.filter(x => x.id !== id);
    return { success: true };
  }],
  ['GET', /^\/verses\/today$/, () => D.VERSE],
  ['GET', /^\/friends$/, () => [D.people.grace, D.people.daniel, D.people.ruth]],
  ['GET', /^\/friends\/this-week$/, () => D.FRIENDS_THIS_WEEK],
  ['POST', /^\/friends\/going$/, () => D.FRIENDS_GOING],
  ['GET', /^\/followers$/, () => ({ followers: [D.people.grace, D.people.daniel, D.people.ruth, D.people.samuel] })],
  ['GET', /^\/notifications$/, () => ({ notifications: D.NOTIFICATIONS })],
  ['GET', /^\/settings$/, () => state.settings],
  ['PATCH', /^\/settings$/, (_m, body) => Object.assign(state.settings, body)],
  ['GET', /^\/churches$/, (_m, _b, q) => {
    const term = (q.get('q') ?? '').trim().toLowerCase();
    return state.churches.filter(c => !term || `${c.name} ${c.city ?? ''}`.toLowerCase().includes(term));
  }],
  ['POST', /^\/churches$/, (_m, body) => {
    const { as_member: asMember, ...fields } = body;
    const row = { id: nextId(), service_times: [], leaders: [], photos: [], verified: false, ...fields, claimed_by: asMember ? null : D.ME.id, created_at: new Date().toISOString() };
    state.churches.push(row);
    return row;
  }],
  ['GET', /^\/my-churches$/, () => []],
  ['GET', /^\/churches\/([^/]+)$/, ([id]) => state.churches.find(c => c.id === id) ?? null],
  ['GET', /^\/churches\/([^/]+)\/recurring$/, ([id]) => D.RECURRING.filter(r => r.church_id === id)],
  ['GET', /^\/churches\/([^/]+)\/events$/, ([id]) => (id === D.CHURCHES[0].id ? [state.events[0].id, state.events[5].id] : [])],
  ['GET', /^\/churches\/([^/]+)\/follow$/, ([id]) => ({ following: state.following.has(id) })],
  ['POST', /^\/churches\/([^/]+)\/follow$/, ([id]) => (state.following.add(id), { following: true })],
  ['DELETE', /^\/churches\/([^/]+)\/follow$/, ([id]) => (state.following.delete(id), { following: false })],
  ['POST', /^\/churches\/([^/]+)\/visits$/, ([id], body) => ({ id: nextId(), church_id: id, ...body, created_at: new Date().toISOString() })],
  ['GET', /^\/serve\/shifts$/, () => D.SHIFTS],
  ['GET', /^\/serve\/hours$/, () => ({ hours: 12 })],
  ['GET', /^\/blocks$/, () => []],
  ['POST', /^\/follow\/([^/]+)$/, ([id]) => (state.following.add(id), { success: true })],
  ['DELETE', /^\/follow\/([^/]+)$/, ([id]) => (state.following.delete(id), { success: true })],
  ['POST', /^\/auth\/refresh$/, () => ({ accessToken: 'preview', refreshToken: 'preview', expiresIn: 86_400 })],
];

const BIOS: Record<string, string> = {
  [D.people.grace.id]: 'Small group leader at Hope Church. Mom of two. Coffee and long walks.',
  [D.people.daniel.id]: 'Saturday prayer walks around Piedmont Park. Come join!',
  [D.people.ruth.id]: 'Nurse, choir alto, learning to be still.',
  [D.people.samuel.id]: 'Baptized this year. Grateful for every invite.',
  [D.people.hope.id]: 'A church for the city. Sundays at 9 and 11.',
};

const DETAILS: Record<string, { hobbies: string; connect: string[]; testimony?: string; hotTakes?: string; prayerRequest?: string }> = {
  [D.people.grace.id]: {
    hobbies: 'Reading, Praying, Cooking, Fellowship',
    connect: ['prayer', 'bible', 'family'],
    testimony: 'Two years ago our church plant had twelve people and no building. Every Wednesday we prayed for a home. Last month we signed a lease in East Atlanta. God is faithful in the waiting.',
    hotTakes: 'Potlucks are a spiritual gift.',
    prayerRequest: 'Wisdom as we set up our new space and welcome new families.',
  },
  [D.people.daniel.id]: {
    hobbies: 'Hiking, Fitness, Music',
    connect: ['meetup', 'new-friends', 'volunteer'],
    hotTakes: 'Sunrise prayer walks beat coffee. (Coffee after is fine.)',
  },
  [D.people.ruth.id]: { hobbies: 'Worship, Swimming, Resting', connect: ['worship', 'prayer'] },
  [D.people.samuel.id]: {
    hobbies: 'Photography, Content Creation, Serving',
    connect: ['mentorship', 'new-friends'],
    testimony: 'A friend invited me to a Night of Worship. I almost didn’t go. This year I was baptized with my whole family watching.',
  },
};

function publicProfile(id: string) {
  const p = Object.values(D.people).find(x => x.id === id) ?? D.people.grace;
  return {
    ...p,
    bio: BIOS[p.id] ?? 'Following Jesus in Atlanta.',
    role: p.id === D.people.hope.id ? 'host' : 'attendee',
    followers_count: 214,
    following_count: 180,
    is_following: state.following.has(p.id),
    created_at: new Date(2025, 0, 1).toISOString(),
    bible_verse: 'The Lord is my shepherd; I shall not want.',
    bible_verse_reference: 'Psalm 23:1',
    hobbies: DETAILS[p.id]?.hobbies ?? 'Worship, Reading, Hiking',
    connect_tags: DETAILS[p.id]?.connect ?? ['prayer', 'meetup'],
    testimony: DETAILS[p.id]?.testimony ?? null,
    hot_takes: DETAILS[p.id]?.hotTakes ?? null,
    prayer_request: DETAILS[p.id]?.prayerRequest ?? null,
    instagram_url: 'https://instagram.com/christlinksocial',
  };
}

function waitlistStatus(eventId: string) {
  const joined = !!state.waitlist.get(eventId);
  return { joined, status: joined ? 'waiting' : null, position: joined ? 13 : null, waiting: joined ? 13 : 12 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body ?? null), { status, headers: { 'Content-Type': 'application/json' } });
}

async function answer(method: string, path: string, query: URLSearchParams, rawBody: unknown): Promise<Response> {
  await new Promise(r => setTimeout(r, LATENCY_MS));
  let body: Row = {};
  if (typeof rawBody === 'string' && rawBody) {
    try {
      body = JSON.parse(rawBody) as Row;
    } catch {
      body = {};
    }
  }
  for (const [m, re, handler] of routes) {
    const match = m === method ? path.match(re) : null;
    if (!match) continue;
    try {
      return json(handler(match.slice(1), body, query));
    } catch (err) {
      const e = err as Error & { status?: number };
      return json({ error: e.message }, e.status ?? 500);
    }
  }
  // Anything else: reads come back empty, writes succeed, so every screen opens.
  return method === 'GET' ? json([]) : json({ success: true });
}

function seedSession(w: BrowserWindow) {
  try {
    const localStorage = w.localStorage;
    if (localStorage.getItem(`${SESSION_KEY}__n`)) return;
    const session = { accessToken: 'preview', refreshToken: 'preview', expiresAt: Date.now() + 30 * 86_400_000, user: D.ME };
    localStorage.setItem(`${SESSION_KEY}__a_0`, JSON.stringify(session));
    localStorage.setItem(`${SESSION_KEY}__n`, 'a:1');
  } catch {
    // Private mode without storage: the app just starts signed out
  }
}

let installed = false;

/** Call once at startup, before any screen fetches. */
export function installDemo() {
  const w = win();
  if (installed || !w) return;
  installed = true;
  seedSession(w);
  // Phones don't show a scrollbar; in the browser it would sit under the floating tab bar
  const style = w.document.createElement('style');
  style.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}input,textarea{outline:none}';
  w.document.head.appendChild(style);
  const realFetch = w.fetch.bind(globalThis);
  w.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, w.location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    return answer(method, url.pathname.slice(4), url.searchParams, init?.body);
  }) as typeof fetch;
}

/** Wide screens get the app in a phone-sized frame next to a short explanation. */
export function shouldFrame(): boolean {
  const w = win();
  return !!w && w.self === w.top && w.innerWidth > 720;
}

export function PhoneFrame() {
  const w = win();
  const src = w ? w.location.pathname + w.location.search : '/';
  return React.createElement(
    'div',
    { style: { minHeight: '100vh', background: 'radial-gradient(circle at 30% 20%, #2a2418, #0e0c0a 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64, padding: 32, boxSizing: 'border-box', fontFamily: '"Instrument Sans", system-ui, sans-serif', color: '#F0EBE0', flexWrap: 'wrap' } },
    React.createElement(
      'div',
      { style: { maxWidth: 340 } },
      React.createElement('div', { style: { color: '#C9A84C', letterSpacing: 2, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' } }, 'Preview'),
      React.createElement('h1', { style: { fontFamily: 'Newsreader, Georgia, serif', fontWeight: 500, fontSize: 40, lineHeight: 1.1, margin: '12px 0' } }, 'Christ Link Social'),
      React.createElement('p', { style: { color: '#B8B0A0', lineHeight: 1.6, fontSize: 15 } }, 'The iPhone and Android app, running in your browser with sample data. Tap around: RSVP, pray, join a waitlist, plan a church visit. Nothing here is saved or sent anywhere.'),
      React.createElement('p', { style: { color: '#8A8272', lineHeight: 1.6, fontSize: 13 } }, 'Payments, push notifications, maps and the camera only work in the phone app. On a phone, open this page directly for the full-screen version.'),
    ),
    React.createElement('iframe', {
      src,
      title: 'Christ Link Social app preview',
      style: { width: PHONE.width, height: PHONE.height, border: '10px solid #1c1a16', borderRadius: 48, boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.25)', background: '#0e0c0a' },
    }),
  );
}
