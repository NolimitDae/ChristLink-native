#!/usr/bin/env node
/**
 * One-time copy of the old website's data (Supabase project) into the new Postgres, run *inside* Railway so no key
 * passes through anyone's laptop or chat. Same rules as ../import-supabase.mjs (which reads a `supabase db dump` file):
 * same ids, same table and column names, one transaction (any failure changes nothing), emails stored lower-case,
 * and it stops if an imported profile would lose its login. docs/CUTOVER.md.
 *
 * Env (set as Railway references on a temporary service in the production project):
 *   SUPABASE_URL                 https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    ${{ChristLink1.SUPABASE_SERVICE_ROLE_KEY}} (reads past row-level security)
 *   DATABASE_URL                 ${{Postgres.DATABASE_URL}} (the target; schema already migrated by the API deploy)
 *   WIPE=1                       empty the copied tables first (re-runs; the final copy at the switch)
 *   DRY_RUN=1                    do everything, print the counts, then roll back
 * Exits 0 on success, 1 on failure (Railway shows the run as completed / failed).
 */
import pg from 'pg';

const PAGE = 1000;
const BATCH = 200;
/** Target tables never filled from Supabase public tables (users comes from auth.users). */
const SKIP = new Set(['users', 'refresh_tokens', '_prisma_migrations']);

export function supabaseClient(url, key, fetchImpl = fetch) {
  const base = url.replace(/\/+$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  /** Every row of a public table, or null when Supabase has no such table. */
  async function table(name) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const res = await fetchImpl(`${base}/rest/v1/${encodeURIComponent(name)}?select=*`, {
        headers: { ...headers, 'Range-Unit': 'items', Range: `${from}-${from + PAGE - 1}`, Prefer: 'count=exact' },
      });
      if (res.status === 404) return null;
      if (!res.ok && res.status !== 206) throw new Error(`${name}: Supabase ${res.status} ${await res.text()}`);
      const page = await res.json();
      rows.push(...page);
      const total = Number(String(res.headers.get('content-range') || '').split('/')[1]);
      if (page.length < PAGE || (Number.isFinite(total) && rows.length >= total)) {
        if (Number.isFinite(total) && rows.length !== total) throw new Error(`${name}: got ${rows.length} of ${total} rows`);
        return rows;
      }
    }
  }

  /** Every auth user (id, email, created_at, last_sign_in_at). */
  async function users() {
    const out = [];
    for (let page = 1; ; page++) {
      const res = await fetchImpl(`${base}/auth/v1/admin/users?page=${page}&per_page=500`, { headers });
      if (!res.ok) throw new Error(`auth users: Supabase ${res.status} ${await res.text()}`);
      const { users: list = [] } = await res.json();
      out.push(...list.map(u => ({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null, last_sign_in_at: u.last_sign_in_at ?? null })));
      if (list.length < 500) return out;
    }
  }

  return { table, users };
}

/** JSON values from the REST API → what node-pg should send for the target column type. */
export function toColumnValue(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === 'json' || dataType === 'jsonb') return JSON.stringify(value);
  return value; // arrays go to ARRAY columns as JS arrays; strings, numbers, booleans as they are
}

async function insertRows(db, table, columns, types, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const n = columns.length;
    const values = chunk.map((_, r) => `(${columns.map((__, c) => `$${r * n + c + 1}`).join(',')})`).join(',');
    const params = chunk.flatMap(row => columns.map(c => toColumnValue(row[c], types.get(c))));
    const res = await db.query(
      `insert into public."${table}" (${columns.map(c => `"${c}"`).join(',')}) values ${values} on conflict do nothing`,
      params,
    );
    inserted += res.rowCount;
  }
  return inserted;
}

/** Copies everything. Returns the per-table report; throws (after rollback) on any problem. */
export async function migrate({ db, source, wipe = false, dryRun = false, log = console.log }) {
  const { rows: cols } = await db.query(
    `select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`,
  );
  const target = new Map();
  for (const r of cols) {
    if (!target.has(r.table_name)) target.set(r.table_name, new Map());
    target.get(r.table_name).set(r.column_name, r.data_type);
  }

  // Read everything first, so a Supabase error never leaves a half-written transaction open for long
  const authUsers = await source.users();
  const data = new Map();
  for (const name of [...target.keys()].sort()) {
    if (SKIP.has(name)) continue;
    const rows = await source.table(name);
    if (rows) data.set(name, rows);
  }

  const report = [];
  await db.query('begin');
  try {
    await db.query("set local session_replication_role = 'replica'");
    if (wipe) {
      for (const name of [...data.keys(), 'refresh_tokens', 'users']) await db.query(`delete from public."${name}"`);
    }

    const withEmail = authUsers.filter(u => u.email);
    const userTypes = target.get('users');
    const userCols = ['id', 'email', 'created_at', 'last_sign_in_at'].filter(c => userTypes.has(c));
    report.push({ table: 'users (auth)', source: authUsers.length, inserted: await insertRows(db, 'users', userCols, userTypes, withEmail) });
    if (withEmail.length < authUsers.length) log(`  ${authUsers.length - withEmail.length} auth user(s) without an email were skipped`);

    for (const [name, rows] of data) {
      const types = target.get(name);
      const dropped = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(c => !types.has(c));
      if (dropped.length) log(`  ${name}: ignoring columns not in target: ${dropped.join(', ')}`);
      // Rows are grouped by the fields they carry, so a field a row doesn't have gets the column default, not null
      const groups = new Map();
      for (const row of rows) {
        const columns = Object.keys(row).filter(c => types.has(c)).sort();
        const key = columns.join(',');
        if (!groups.has(key)) groups.set(key, { columns, rows: [] });
        groups.get(key).rows.push(row);
      }
      let inserted = 0;
      for (const g of groups.values()) inserted += await insertRows(db, name, g.columns, types, g.rows);
      report.push({ table: name, source: rows.length, inserted });
    }

    // Sequences continue after the copied ids
    const { rows: seqs } = await db.query(`
      select c.relname as table_name, a.attname as column_name, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
      from pg_class c join pg_attribute a on a.attrelid = c.oid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0
        and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null`);
    for (const s of seqs) {
      await db.query(`select setval($1, greatest((select coalesce(max("${s.column_name}"), 0) from public."${s.table_name}"), 1))`, [s.seq]);
    }

    // Sign-in matches lower-case emails; refuse to merge two accounts silently
    const { rows: clashes } = await db.query(
      `select lower(trim(email)) as email from public.users group by 1 having count(*) > 1`,
    );
    if (clashes.length) throw new Error(`Emails shared by more than one account once lower-cased: ${clashes.map(r => r.email).join(', ')}`);
    await db.query(`update public.users set email = lower(trim(email)) where email <> lower(trim(email))`);
    await db.query(`update public.profiles set email = lower(trim(email)) where email <> lower(trim(email))`);

    const { rows: orphans } = await db.query(
      `select p.id, p.email from public.profiles p where not exists (select 1 from public.users u where u.id = p.id)`,
    );
    if (orphans.length) {
      throw new Error(
        `${orphans.length} profile(s) have no login (their email already has another account here): ${orphans
          .slice(0, 20)
          .map(r => r.email ?? r.id)
          .join(', ')}. Run with WIPE=1 or remove those accounts first.`,
      );
    }
    await db.query(`
      insert into public.profiles (id, email, full_name)
      select u.id, u.email, split_part(u.email, '@', 1) from public.users u
      where not exists (select 1 from public.profiles p where p.id = u.id)
      on conflict do nothing`);

    await db.query(dryRun ? 'rollback' : 'commit');
  } catch (err) {
    await db.query('rollback');
    throw err;
  }
  return report;
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
    console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.');
    process.exit(1);
  }
  const wipe = process.env.WIPE === '1';
  const dryRun = process.env.DRY_RUN === '1';
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log(`Copying from ${SUPABASE_URL}${wipe ? ' (wipe first)' : ''}${dryRun ? ' — DRY RUN, rolled back at the end' : ''}`);
  try {
    const report = await migrate({ db, source: supabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), wipe, dryRun });
    for (const r of report) console.log(`  ${r.table.padEnd(28)} source ${String(r.source).padStart(5)}  inserted ${String(r.inserted).padStart(5)}${r.inserted < r.source ? '  (rest already present)' : ''}`);
    const { rows } = await db.query('select (select count(*) from users) users, (select count(*) from profiles) profiles, (select count(*) from events) events, (select count(*) from tickets) tickets');
    console.log(`Done${dryRun ? ' (dry run: nothing kept)' : ''}. Target now has ${JSON.stringify(rows[0])}`);
  } catch (err) {
    console.error('Copy failed, nothing was changed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (process.argv[1]?.endsWith('migrate.mjs')) main();
