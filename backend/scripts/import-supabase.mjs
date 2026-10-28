#!/usr/bin/env node
/**
 * Copies production data from a Supabase data dump into the Railway Postgres database.
 *
 *   1. Dump (you run this; the password never leaves your terminal):
 *        npx supabase@latest db dump --db-url "<supabase connection string>" --data-only --use-copy -s public,auth -f prod_data.sql
 *   2. Import (DATABASE_URL = the target Railway Postgres *public* URL):
 *        DATABASE_URL=postgresql://... node scripts/import-supabase.mjs prod_data.sql [--wipe]
 *
 * Loads every `public.*` table that exists in the target with the same columns, and `auth.users`
 * (id, email, created_at, last_sign_in_at only) into `users`. Everything runs in one transaction with
 * foreign-key triggers off, so table order doesn't matter and a failure changes nothing.
 * --wipe empties the copied tables first (use it when re-running against staging).
 */
import fs from 'node:fs';
import readline from 'node:readline';
import pg from 'pg';

const BATCH = 500;

/** Postgres COPY text format → JS value (null for \N). */
export function decodeCopyField(field) {
  if (field === '\\N') return null;
  if (!field.includes('\\')) return field;
  // \ooo and \xHH are raw bytes (possibly parts of one UTF-8 character), so decode to bytes first
  const simple = { b: 8, f: 12, n: 10, r: 13, t: 9, v: 11 };
  const bytes = [];
  for (let i = 0; i < field.length; i++) {
    if (field[i] !== '\\') {
      bytes.push(...Buffer.from(field[i], 'utf8'));
      continue;
    }
    const rest = field.slice(i + 1);
    const oct = rest.match(/^[0-7]{1,3}/);
    const hex = rest.match(/^x([0-9a-fA-F]{1,2})/);
    if (oct) {
      bytes.push(parseInt(oct[0], 8));
      i += oct[0].length;
    } else if (hex) {
      bytes.push(parseInt(hex[1], 16));
      i += hex[0].length;
    } else {
      const c = rest[0];
      bytes.push(...(c in simple ? [simple[c]] : Buffer.from(c, 'utf8')));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Parses `COPY "schema"."table" ("a", "b") FROM stdin;` → { schema, table, columns }. */
export function parseCopyHeader(line) {
  const m = line.match(/^COPY\s+"?([\w]+)"?\."?([\w]+)"?\s*\(([^)]*)\)\s+FROM\s+stdin;/i);
  if (!m) return null;
  return { schema: m[1], table: m[2], columns: m[3].split(',').map((c) => c.trim().replace(/^"|"$/g, '')) };
}

const AUTH_USER_COLUMNS = ['id', 'email', 'created_at', 'last_sign_in_at'];

async function main() {
  const file = process.argv[2];
  const wipe = process.argv.includes('--wipe');
  if (!file || !process.env.DATABASE_URL) {
    console.error('Usage: DATABASE_URL=postgresql://... node scripts/import-supabase.mjs <prod_data.sql> [--wipe]');
    process.exit(1);
  }

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows: cols } = await db.query(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  const targetColumns = new Map();
  for (const r of cols) {
    if (!targetColumns.has(r.table_name)) targetColumns.set(r.table_name, new Set());
    targetColumns.get(r.table_name).add(r.column_name);
  }

  const counts = {};
  const skipped = new Set();
  await db.query('begin');
  try {
    await db.query("set local session_replication_role = 'replica'");
    let current = null; // { table, keep: index[], columns: string[], rows: [] }
    const wiped = new Set();

    const flush = async () => {
      if (!current || current.rows.length === 0) return;
      const n = current.columns.length;
      const values = current.rows
        .map((_, i) => `(${current.columns.map((__, j) => `$${i * n + j + 1}`).join(',')})`)
        .join(',');
      await db.query(
        `insert into public."${current.table}" (${current.columns.map((c) => `"${c}"`).join(',')}) values ${values} on conflict do nothing`,
        current.rows.flat(),
      );
      counts[current.table] = (counts[current.table] ?? 0) + current.rows.length;
      current.rows = [];
    };

    const lines = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
    for await (const line of lines) {
      if (current) {
        if (line === '\\.') {
          await flush();
          current = null;
          continue;
        }
        if (current.skip) continue;
        const fields = line.split('\t');
        current.rows.push(current.keep.map((i) => decodeCopyField(fields[i])));
        if (current.rows.length >= BATCH) await flush();
        continue;
      }
      const header = parseCopyHeader(line);
      if (!header) continue;

      let table = header.table;
      let wanted;
      if (header.schema === 'auth' && header.table === 'users') {
        table = 'users';
        wanted = AUTH_USER_COLUMNS;
      } else if (header.schema === 'public' && targetColumns.has(header.table)) {
        wanted = header.columns.filter((c) => targetColumns.get(header.table).has(c));
        const dropped = header.columns.filter((c) => !targetColumns.get(header.table).has(c));
        if (dropped.length) console.warn(`  ${table}: ignoring columns not in target: ${dropped.join(', ')}`);
      } else {
        skipped.add(`${header.schema}.${header.table}`);
        current = { skip: true, rows: [] };
        continue;
      }

      if (wipe && !wiped.has(table)) {
        await db.query(`delete from public."${table}"`);
        wiped.add(table);
      }
      current = { table, columns: wanted, keep: wanted.map((c) => header.columns.indexOf(c)), rows: [] };
    }

    // Sequences (e.g. verses.id) must continue after the imported ids
    const { rows: seqs } = await db.query(`
      select c.relname as table_name, a.attname as column_name, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
      from pg_class c join pg_attribute a on a.attrelid = c.oid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0
        and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null`);
    for (const s of seqs) {
      await db.query(
        `select setval($1, greatest((select coalesce(max("${s.column_name}"), 0) from public."${s.table_name}"), 1))`,
        [s.seq],
      );
    }

    // Users with no profile (signed up but never finished) get one, as sign-in would create it
    await db.query(`
      insert into public.profiles (id, email, full_name)
      select u.id, u.email, split_part(u.email, '@', 1) from public.users u
      where u.email is not null and not exists (select 1 from public.profiles p where p.id = u.id)
      on conflict do nothing`);

    await db.query('commit');
  } catch (err) {
    await db.query('rollback');
    console.error("Import failed, nothing was changed:", err.stack ?? err.message);
    process.exitCode = 1;
    await db.end();
    return;
  }
  await db.end();

  console.log('Imported rows:');
  for (const [t, n] of Object.entries(counts).sort()) console.log(`  ${t.padEnd(28)} ${n}`);
  if (skipped.size) console.log(`Skipped (not copied): ${[...skipped].sort().join(', ')}`);
}

if (process.argv[1]?.endsWith('import-supabase.mjs')) main();
