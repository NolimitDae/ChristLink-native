/** Sample data for the web preview (docs/WEB-PREVIEW.md). Dates are relative to today so the app always looks current. */
const U = (id: string) => `https://images.unsplash.com/${id}?w=900&q=70`;
const NOW = new Date();
/** UTC date `d` days from today at hour `h` (UTC). */
const day = (d: number, h = 19) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + d, h, 0, 0)).toISOString();
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

type Row = Record<string, unknown>;

export const ME = { id: '11111111-1111-4111-8111-111111111111', email: 'preview@christlinksocial.com' };

export const people = {
  grace: { id: 'aaaaaaaa-0000-4000-8000-000000000001', full_name: 'Grace Adeyemi', avatar_color: 'linear-gradient(135deg,#C9A84C,#8B6914)', city: 'Atlanta' },
  daniel: { id: 'aaaaaaaa-0000-4000-8000-000000000002', full_name: 'Daniel Okafor', avatar_color: 'linear-gradient(135deg,#4E7BC9,#2A3F7A)', city: 'Atlanta' },
  ruth: { id: 'aaaaaaaa-0000-4000-8000-000000000003', full_name: 'Ruth Mensah', avatar_color: 'linear-gradient(135deg,#C96B4E,#7A2F2A)', city: 'Decatur' },
  hope: { id: 'aaaaaaaa-0000-4000-8000-000000000004', full_name: 'Hope Church Atlanta', avatar_color: '#3E6B4F', city: 'Atlanta' },
  samuel: { id: 'aaaaaaaa-0000-4000-8000-000000000005', full_name: 'Samuel Bright', avatar_color: 'linear-gradient(135deg,#6B4EC9,#2F2A7A)', city: 'Atlanta' },
};

const ev = (n: number, o: Row): Row => ({
  id: `eeeeeeee-0000-4000-8000-00000000000${n}`,
  host_id: people.hope.id,
  status: 'published',
  format: 'in_person',
  created_at: day(-10),
  is_paid: false,
  forum_enabled: true,
  ticket_types: [],
  host_name: people.hope.full_name,
  host_avatar_color: people.hope.avatar_color,
  host_role: 'verified',
  city: 'Atlanta',
  state: 'GA',
  ...o,
});

export const EVENTS: Row[] = [
  ev(1, {
    name: 'Night of Worship', event_type: 'Worship', start_date: day(1, 0), end_date: day(1, 3), venue_name: 'The Tabernacle',
    address: '152 Luckie St NW', lat: 33.7588, lng: -84.3916, cover_url: U('photo-1470225620780-dba8ba36b745'), confirmed_rsvps: 214, max_capacity: 400,
    description: 'An evening of worship, prayer and testimony with bands from across the city. Doors open at 6:30pm. Bring a friend.',
  }),
  ev(2, {
    name: 'Young Adults Bible Study', event_type: 'Bible Study', start_date: day(3, 23), venue_name: 'Grace Fellowship Hall',
    cover_url: U('photo-1504052434569-70ad5836ab65'), confirmed_rsvps: 40, max_capacity: 40,
    description: 'Walking through the book of James together. Coffee and snacks provided. This one is full — join the waitlist.',
  }),
  ev(3, {
    name: 'Fall Prayer Retreat', event_type: 'Retreat', start_date: day(14, 14), end_date: day(16, 18), venue_name: 'Lake Lanier Lodge', city: 'Gainesville',
    is_paid: true, cover_url: U('photo-1438232992991-995b7058bbb3'), confirmed_rsvps: 52, max_capacity: 80,
    ticket_types: [{ id: 'tt-1', event_id: 'eeeeeeee-0000-4000-8000-000000000003', name: 'Weekend pass', price_cents: 14500, quantity: 80, sold: 52, created_at: day(-10) }],
    description: 'Three days of rest, silence and prayer by the lake. Meals and lodging included.',
  }),
  ev(4, {
    name: 'City Outreach Saturday', event_type: 'Outreach', start_date: day(5, 14), venue_name: 'Centennial Olympic Park',
    cover_url: U('photo-1529156069898-49953e39b3ac'), confirmed_rsvps: 91, description: 'Serving lunch and care packages downtown. All ages welcome.',
  }),
  ev(5, {
    name: 'Gospel Choir Concert', event_type: 'Concert', start_date: day(20, 0), venue_name: 'Fox Theatre', is_paid: true,
    cover_url: U('photo-1507692049790-de58290a4334'), confirmed_rsvps: 640, max_capacity: 1200,
    ticket_types: [
      { id: 'tt-2', event_id: 'eeeeeeee-0000-4000-8000-000000000005', name: 'General admission', price_cents: 2500, quantity: 1000, sold: 590, created_at: day(-10) },
      { id: 'tt-3', event_id: 'eeeeeeee-0000-4000-8000-000000000005', name: 'VIP', price_cents: 6000, quantity: 200, sold: 50, created_at: day(-10) },
    ],
    description: 'Atlanta Mass Choir live, with special guests.',
  }),
  ev(6, {
    name: 'Youth Night: Game On', event_type: 'Youth', start_date: day(6, 23), venue_name: 'Hope Church Youth Center',
    cover_url: U('photo-1544027993-37dbfe43562a'), confirmed_rsvps: 73, description: 'Games, pizza and a short message for grades 6–12.',
  }),
  ev(7, {
    name: 'Women’s Prayer Breakfast', event_type: 'Prayer', start_date: day(8, 13), venue_name: 'The Gathering Room',
    cover_url: U('photo-1529070538774-1843cb3265df'), confirmed_rsvps: 46, max_capacity: 60, description: 'Breakfast, worship and prayer together.',
  }),
  ev(8, {
    name: 'Worship Leaders Conference', event_type: 'Conference', start_date: day(30, 14), end_date: day(31, 22), venue_name: 'Georgia World Congress Center',
    is_paid: true, cover_url: U('photo-1475721027785-f74eccf877e2'), confirmed_rsvps: 380,
    ticket_types: [{ id: 'tt-4', event_id: 'eeeeeeee-0000-4000-8000-000000000008', name: 'Two-day pass', price_cents: 8900, quantity: null, sold: 380, created_at: day(-10) }],
    description: 'Two days of sessions, workshops and worship for church teams.',
  }),
];

export const POSTS: Row[] = [
  { id: 'pppppppp-0000-4000-8000-000000000001', author_id: people.grace.id, body: 'Our small group prayed for my mom last week and her scans came back clear today. God is faithful! 🙌', post_type: 'answered', amen_count: 48, reply_count: 12, created_at: ago(2), profiles: people.grace },
  { id: 'pppppppp-0000-4000-8000-000000000002', author_id: people.daniel.id, body: 'Starting a 6am prayer walk around Piedmont Park on Saturdays. Anyone want to join?', post_type: 'encouragement', amen_count: 21, reply_count: 5, created_at: ago(5), profiles: people.daniel },
  { id: 'pppppppp-0000-4000-8000-000000000003', author_id: people.ruth.id, body: '“Be still, and know that I am God.” Needed this reminder before a big week at work.', post_type: 'praise', amen_count: 33, reply_count: 3, created_at: ago(26), profiles: people.ruth },
  { id: 'pppppppp-0000-4000-8000-000000000004', author_id: people.samuel.id, body: 'Three years ago I walked into Hope Church alone. Last night I got baptized with my whole family watching. Never stop inviting people.', post_type: 'testimony', amen_count: 87, reply_count: 19, created_at: ago(40), profiles: people.samuel },
];

const prayer = (n: number, o: Row): Row => ({
  id: `rrrrrrrr-0000-4000-8000-00000000000${n}`, is_anonymous: false, answered_at: null, testimony: null, has_prayed: false, is_mine: false,
  is_friend: false, church_id: null, author_avatar_url: null, ...o,
});
export const PRAYERS: Row[] = [
  prayer(1, { body: 'Please pray for my brother as he starts a new job on Monday. He has been out of work for eight months.', created_at: ago(3), prayed_count: 27, has_prayed: true, is_friend: true, author_id: people.daniel.id, author_name: people.daniel.full_name, author_avatar_color: people.daniel.avatar_color }),
  prayer(2, { body: 'Healing for my grandmother after her surgery.', is_anonymous: true, created_at: ago(9), prayed_count: 64, author_id: null, author_name: null, author_avatar_color: null }),
  prayer(3, { body: 'Wisdom for our church plant team as we look for a building.', created_at: ago(50), answered_at: ago(4), testimony: 'We signed the lease on a space in East Atlanta this morning. Thank you all for praying!', prayed_count: 112, has_prayed: true, author_id: people.grace.id, author_name: people.grace.full_name, author_avatar_color: people.grace.avatar_color }),
  prayer(4, { body: 'Peace for my family as we care for my dad. It has been a long month.', created_at: ago(20), prayed_count: 18, author_id: people.ruth.id, author_name: people.ruth.full_name, author_avatar_color: people.ruth.avatar_color }),
  prayer(5, { body: 'Pray for our youth team leading worship for the first time this Friday!', created_at: ago(30), prayed_count: 9, is_mine: true, author_id: ME.id, author_name: 'Jordan Ellis', author_avatar_color: 'linear-gradient(135deg,#C9A84C,#8B6914)' }),
];

export const TICKETS: Row[] = [
  {
    id: 'tttttttt-0000-4000-8000-000000000001', event_id: EVENTS[4].id, user_id: ME.id, quantity: 2, unit_price_cents: 2500, total_charged_cents: 5550,
    status: 'confirmed', code: 'GSP-7Q4K', created_at: day(-2), confirmed_at: day(-2), event_name: EVENTS[4].name, event_start_date: EVENTS[4].start_date,
    event_city: 'Atlanta', event_venue_name: 'Fox Theatre', event_cover_url: EVENTS[4].cover_url, ticket_type_name: 'General admission', event_type: 'Concert',
  },
  {
    id: 'tttttttt-0000-4000-8000-000000000002', event_id: 'eeeeeeee-0000-4000-8000-000000000099', user_id: ME.id, quantity: 1, unit_price_cents: 1500, total_charged_cents: 1605,
    status: 'confirmed', code: 'EST-2K9P', created_at: day(-40), confirmed_at: day(-40), event_name: 'Easter Sunrise Service', event_start_date: day(-30, 11),
    event_city: 'Atlanta', event_venue_name: 'Piedmont Park', event_cover_url: U('photo-1438232992991-995b7058bbb3'), ticket_type_name: 'General admission', checked_in: true,
  },
];

export const RSVPS: Row[] = [
  { id: 'vvvvvvvv-0000-4000-8000-000000000001', event_id: EVENTS[0].id, user_id: ME.id, status: 'confirmed', created_at: day(-2), event_name: EVENTS[0].name, event_start_date: EVENTS[0].start_date, event_city: 'Atlanta', event_cover_url: EVENTS[0].cover_url },
];

export const PROFILE: Row = {
  id: ME.id, email: ME.email, full_name: 'Jordan Ellis', city: 'Atlanta', role: 'host', avatar_color: 'linear-gradient(135deg,#C9A84C,#8B6914)',
  bio: 'Worship leader. Coffee. Community.', created_at: day(-200), host_stripe_accounts: [{ stripe_account_id: 'acct_demo', onboarding_complete: true, payouts_enabled: true, charges_enabled: true }], followers_count: 128, following_count: 96,
  identity_verified: true, bible_verse: 'Let all that you do be done in love.', bible_verse_reference: '1 Corinthians 16:14',
  hobbies: 'Worship, Music, Hiking, Mentorship', connect_tags: ['worship', 'meetup', 'mentorship'],
  testimony: 'I led worship for years without really resting in it. A quiet season at our prayer retreat changed that.',
};

export const CHURCHES: Row[] = [
  {
    id: 'cccccccc-0000-4000-8000-000000000001', name: 'Hope Church Atlanta', denomination: 'Non-denominational', address: '600 Peachtree St NE', city: 'Atlanta',
    state: 'GA', zip: '30308', lat: 33.7713, lng: -84.3857,
    service_times: [{ day: 0, time: '09:00', label: 'First service' }, { day: 0, time: '11:00', label: 'Second service' }],
    livestream_url: 'https://www.youtube.com', website_url: 'https://christlinksocial.com', leaders: [{ name: 'Pastor James Cole', title: 'Lead Pastor' }, { name: 'Maya Cole', title: 'Worship' }],
    photos: [U('photo-1438232992991-995b7058bbb3')], about: 'A church for the city. Sundays at 9 and 11, with kids church at both services.', verified: true,
    claimed_by: people.hope.id, created_at: day(-300),
  },
  {
    id: 'cccccccc-0000-4000-8000-000000000002', name: 'Grace Fellowship', denomination: 'Baptist', address: '120 Ponce de Leon Ave', city: 'Atlanta', state: 'GA',
    zip: '30308', lat: 33.7726, lng: -84.3712, service_times: [{ day: 0, time: '10:30' }], leaders: [], photos: [], about: 'Family church in Midtown.',
    verified: false, claimed_by: null, created_at: day(-300),
  },
];

export const RECURRING: Row[] = [
  { id: 'rec-1', church_id: CHURCHES[0].id, name: 'Wednesday Prayer Night', frequency: 'weekly', weekday: 3, start_time: '19:00', duration_minutes: 60, starts_on: '2026-01-07', is_service: true },
  { id: 'rec-2', church_id: CHURCHES[0].id, name: 'Young Adults', frequency: 'weekly', weekday: 4, start_time: '19:30', duration_minutes: 90, starts_on: '2026-01-08', is_service: false },
];

export const SHIFTS: Row[] = [
  { shift_id: 'ssssssss-0000-4000-8000-000000000001', role_id: 'role-1', role_name: 'Greeter', description: 'Welcome people at the doors and help first-time guests find their way.', requirements: null, starts_at: day(6, 13), ends_at: day(6, 15), spots: 6, taken: 4, event_id: null, event_name: null, church_id: CHURCHES[0].id, church_name: 'Hope Church Atlanta', my_signup_id: null, my_status: null, my_code: null },
  { shift_id: 'ssssssss-0000-4000-8000-000000000002', role_id: 'role-2', role_name: 'Lunch service', description: 'Serve lunch and hand out care packages.', requirements: 'Closed-toe shoes', starts_at: day(5, 14), ends_at: day(5, 17), spots: 20, taken: 13, event_id: EVENTS[3].id, event_name: EVENTS[3].name, church_id: null, church_name: null, my_signup_id: null, my_status: null, my_code: null },
];

export const NOTIFICATIONS: Row[] = [
  { id: 'n1', user_id: ME.id, type: 'prayer_prayed', title: 'Grace prayed for you', body: '“Pray for our youth team leading worship for the first time…”', data: {}, read: false, created_at: ago(1) },
  { id: 'n2', user_id: ME.id, type: 'friend_rsvp', title: 'Daniel Okafor is going to Night of Worship', body: 'Tap to see the event and join them.', data: { eventId: EVENTS[0].id }, read: false, created_at: ago(6) },
  { id: 'n3', user_id: ME.id, type: 'ticket_confirmed', title: 'Ticket confirmed', body: 'Your 2 tickets for "Gospel Choir Concert" are confirmed.', data: {}, read: true, created_at: ago(48) },
];

export const FRIENDS_GOING = [{ event_id: EVENTS[0].id, friend_count: 3, friends: [people.grace, people.daniel, people.ruth] }];

export const FRIENDS_THIS_WEEK = [
  { event_id: EVENTS[0].id, event_name: EVENTS[0].name, start_date: EVENTS[0].start_date, cover_url: EVENTS[0].cover_url, friends: [people.grace, people.daniel] },
  { event_id: EVENTS[3].id, event_name: EVENTS[3].name, start_date: EVENTS[3].start_date, cover_url: EVENTS[3].cover_url, friends: [people.samuel] },
];

export const VERSE = { reference: 'Psalm 46:10', text: 'Be still, and know that I am God.', translation: 'WEB' };

export const ATTENDEES = [people.grace, people.daniel, people.ruth, people.samuel];
