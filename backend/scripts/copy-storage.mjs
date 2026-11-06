#!/usr/bin/env node
/**
 * Copies public Supabase Storage files that the imported data points at into Cloudflare R2,
 * then rewrites the stored URLs. Run after import-supabase.mjs:
 *
 *   DATABASE_URL=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... R2_PUBLIC_URL=... \
 *     node scripts/copy-storage.mjs [--dry-run]
 *
 * Finds every text / text[] column in the public schema holding
 * https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path> and maps buckets to the
 * new prefixes (avatars → avatars/, banner-images → banners/, event-images → events/). Safe to re-run:
 * already-rewritten URLs no longer match. Private files (ID documents) are not copied.
 */
import pg from 'pg';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const URL_RE = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/([^/\s"']+)\/([^\s"',}]+)/g;
const PREFIX = { avatars: 'avatars', 'banner-images': 'banners', 'event-images': 'events' };

export function newKey(bucket, path) {
  return `${PREFIX[bucket] ?? bucket}/${decodeURIComponent(path.split('?')[0])}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = process.env;
  for (const k of ['DATABASE_URL', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL']) {
    if (!env[k]) {
      console.error(`Missing ${k}`);
      process.exit(1);
    }
  }
  const publicBase = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  await db.connect();

  const { rows: columns } = await db.query(`
    select table_name, column_name, data_type from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and (data_type in ('text', 'character varying', 'jsonb') or (data_type = 'ARRAY' and udt_name = '_text'))`);

  const copied = new Map(); // old url → new url
  let failed = 0;
  for (const { table_name: t, column_name: c, data_type } of columns) {
    const asText = data_type === 'text' || data_type === 'character varying' ? `"${c}"` : `"${c}"::text`;
    const { rows } = await db.query(`select distinct ${asText} as v from public."${t}" where ${asText} like '%.supabase.co/storage/v1/object/public/%'`);
    for (const { v } of rows) {
      for (const m of v.matchAll(URL_RE)) {
        const [url, bucket, path] = m;
        if (copied.has(url)) continue;
        const key = newKey(bucket, path);
        try {
          if (!dryRun) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await s3.send(new PutObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: key,
              Body: Buffer.from(await res.arrayBuffer()),
              ContentType: res.headers.get('content-type') ?? 'application/octet-stream',
            }));
          }
          copied.set(url, `${publicBase}/${encodeURI(key)}`);
        } catch (err) {
          failed++;
          console.warn(`  could not copy ${url}: ${err.message}`);
        }
      }
    }
    if (dryRun || copied.size === 0) continue;
    // Rewrite every copied URL in this column (text, arrays and jsonb all round-trip through text)
    for (const [oldUrl, newUrl] of copied) {
      const cast = data_type === 'jsonb' ? '::jsonb' : data_type === 'ARRAY' ? '::text[]' : '';
      await db.query(
        `update public."${t}" set "${c}" = replace(${asText}, $1, $2)${cast} where ${asText} like '%' || $1 || '%'`,
        [oldUrl, newUrl],
      );
    }
  }
  await db.end();
  console.log(`${dryRun ? 'Would copy' : 'Copied'} ${copied.size} files${failed ? `, ${failed} failed (listed above)` : ''}.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('copy-storage.mjs')) main();
