// node --test backend/scripts/supabase-migrate/   (needs a migrated Postgres: MIGRATE_TEST_DATABASE_URL)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import pg from 'pg';
import { migrate, supabaseClient, toColumnValue } from './migrate.mjs';

const DB_URL = process.env.MIGRATE_TEST_DATABASE_URL;
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const E1 = '33333333-3333-4333-8333-333333333333';

// A stand-in for the old site's Supabase: PostgREST tables + the auth admin API, with paging
const tables = {
  profiles: [
    { id: U1, email: 'Grace@Example.com', full_name: 'Grace', connect_tags: ['Worship Team', 'Mentorship'], prayer_supporters: [{ id: U2 }], hobbies: 'Music' },
    { id: U2, email: 'peter@example.com', full_name: 'Peter', connect_tags: null, prayer_supporters: [], old_column: 'gone' },
  ],
  events: [{ id: E1, host_id: U1, name: 'Night of Worship', tags: ['worship', "it's \"quoted\""], gallery_urls: [], status: 'published', is_paid: false }],
  notifications: Array.from({ length: 1205 }, (_, i) => ({ user_id: U1, type: 'test', title: `n${i}`, body: 'b', data: { eventId: E1, n: i }, read: false })),
};
let users = [
  { id: U1, email: 'Grace@Example.com', created_at: '2026-02-21T00:00:00Z', last_sign_in_at: null },
  { id: U2, email: 'peter@example.com', created_at: '2026-02-22T00:00:00Z', last_sign_in_at: '2026-10-01T00:00:00Z' },
  { id: '44444444-4444-4444-8444-444444444444', email: null, created_at: '2026-02-23T00:00:00Z' }, // phone-only
];
const seenKeys = new Set();
const fake = http.createServer((req, res) => {
  seenKeys.add(`${req.headers.apikey}|${req.headers.authorization}`);
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/auth/v1/admin/users') {
    const page = Number(url.searchParams.get('page'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ users: page === 1 ? users : [] }));
  }
  const name = url.pathname.replace('/rest/v1/', '');
  if (!tables[name]) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"code":"PGRST205"}');
  }
  const [from, to] = String(req.headers.range).split('-').map(Number);
  const all = tables[name];
  const page = all.slice(from, Math.min(to + 1, from + 1000)); // PostgREST max-rows 1000
  res.writeHead(page.length < all.length ? 206 : 200, { 'Content-Type': 'application/json', 'Content-Range': `${from}-${from + page.length - 1}/${all.length}` });
  res.end(JSON.stringify(page));
});

let db;
let source;
before(async () => {
  await new Promise(r => fake.listen(0, r));
  source = supabaseClient(`http://127.0.0.1:${fake.address().port}/`, 'service-key');
  db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
});
after(async () => {
  await db.end();
  fake.close();
});

const quiet = () => undefined;
const count = async t => Number((await db.query(`select count(*) from public."${t}"`)).rows[0].count);

test('value conversion for json and array columns', () => {
  assert.equal(toColumnValue({ a: 1 }, 'jsonb'), '{"a":1}');
  assert.equal(toColumnValue('[]', 'jsonb'), '"[]"'); // a JSON string stays a JSON string
  assert.deepEqual(toColumnValue(['a'], 'ARRAY'), ['a']);
  assert.equal(toColumnValue(null, 'jsonb'), null);
});

test('dry run copies nothing', async () => {
  const before = [await count('users'), await count('profiles'), await count('notifications')];
  const report = await migrate({ db, source, wipe: true, dryRun: true, log: quiet });
  assert.equal(report.find(r => r.table === 'notifications').inserted, 1205);
  assert.deepEqual([await count('users'), await count('profiles'), await count('notifications')], before);
});

test('copies users, profiles and tables with ids, arrays, json and paging intact', async () => {
  const report = await migrate({ db, source, wipe: true, log: quiet });
  assert.deepEqual(report.find(r => r.table === 'users (auth)'), { table: 'users (auth)', source: 3, inserted: 2 });
  assert.equal(await count('notifications'), 1205);
  const { rows: u } = await db.query('select id, email from users order by email');
  assert.deepEqual(u, [{ id: U1, email: 'grace@example.com' }, { id: U2, email: 'peter@example.com' }]);
  const { rows: p } = await db.query('select email, connect_tags, prayer_supporters, hobbies from profiles where id = $1', [U1]);
  assert.deepEqual(p[0], { email: 'grace@example.com', connect_tags: ['Worship Team', 'Mentorship'], prayer_supporters: [{ id: U2 }], hobbies: 'Music' });
  const { rows: e } = await db.query('select tags, gallery_urls from events where id = $1', [E1]);
  assert.deepEqual(e[0], { tags: ['worship', "it's \"quoted\""], gallery_urls: [] });
  const { rows: n } = await db.query("select data from notifications where title = 'n1204'");
  assert.deepEqual(n[0].data, { eventId: E1, n: 1204 });
  assert.ok([...seenKeys].every(k => k === 'service-key|Bearer service-key'));
});

test('re-running with WIPE gives the same result', async () => {
  await migrate({ db, source, wipe: true, log: quiet });
  assert.equal(await count('users'), 2);
  assert.equal(await count('notifications'), 1205);
});

test('stops, changing nothing, when an email already has a different account here', async () => {
  await db.query("insert into users (id, email) values ('55555555-5555-4555-8555-555555555555', 'new@example.com')");
  users = [...users, { id: '66666666-6666-4666-8666-666666666666', email: 'New@Example.com' }];
  tables.profiles.push({ id: '66666666-6666-4666-8666-666666666666', email: 'New@Example.com', full_name: 'Dup' });
  await assert.rejects(migrate({ db, source, log: quiet }), /more than one account|have no login/);
  assert.equal(await count('users'), 3); // the 2 copied + the new one; nothing from the failed run
});
