#!/usr/bin/env node
/**
 * Serves the Christ Link web app (the Expo web export) on christlinksocial.com. Railway service "ChristLink-Web"
 * (Dockerfile.web, web/railway.toml); runbook: docs/CUTOVER.md.
 *
 *   /                          the app (single-page: unknown paths get index.html, the router takes over)
 *   /health                    200 for Railway's health check
 *   /.well-known/…             iOS universal links + Android App Links, generated from env
 *   POST /webhook              passed to the API, so the Stripe webhook URL of the old site keeps working
 *   /api/…                     404 JSON: the API lives on its own domain (EXPO_PUBLIC_API_BASE)
 *
 * Env: PORT (Railway sets it), WEB_ROOT (default ./dist), API_ORIGIN (e.g. the API's Railway URL; enables /webhook),
 * APPLE_TEAM_ID, IOS_BUNDLE_ID, ANDROID_PACKAGE, ANDROID_SHA256_FINGERPRINTS (comma-separated),
 * CANONICAL_HOST (e.g. christlinksocial.com: other hosts such as www. get a 301 there).
 * No dependencies: Node's http, fs and zlib only.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(process.env.WEB_ROOT || path.join(path.dirname(new URL(import.meta.url).pathname), '../dist'));
const PORT = Number(process.env.PORT || 8080);
const API_ORIGIN = (process.env.API_ORIGIN || '').replace(/\/+$/, '');
const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').toLowerCase();
const WEBHOOK_MAX_BYTES = 1_000_000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.txt', '.ttf', '.otf']);

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(), payment=(self "https://js.stripe.com")',
};

export function wellKnown(file, env = process.env) {
  if (file === 'apple-app-site-association') {
    if (!env.APPLE_TEAM_ID) return null;
    const appID = `${env.APPLE_TEAM_ID}.${env.IOS_BUNDLE_ID || 'com.christlink.app'}`;
    return {
      applinks: {
        details: [
          {
            appIDs: [appID],
            components: [
              { '/': '/event/*', comment: 'Event pages open in the app' },
              { '/': '/church/*', comment: 'Church pages open in the app' },
            ],
          },
        ],
      },
      webcredentials: { apps: [appID] },
    };
  }
  if (file === 'assetlinks.json') {
    const prints = (env.ANDROID_SHA256_FINGERPRINTS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!prints.length) return null;
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: env.ANDROID_PACKAGE || 'com.christlink.app', sha256_cert_fingerprints: prints },
      },
    ];
  }
  return null;
}

/** Resolves a URL path to a file inside ROOT, or null (never escapes ROOT). */
export function fileFor(urlPath, root = ROOT) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const full = path.resolve(root, `.${path.posix.normalize(`/${decoded}`)}`);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  try {
    return fs.statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

/** Hashed build output never changes under the same name; everything else is revalidated. */
export function cacheControlFor(urlPath) {
  if (urlPath.startsWith('/_expo/static/') || urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (urlPath.startsWith('/brand/') || urlPath.startsWith('/fonts/')) return 'public, max-age=86400';
  return 'no-cache';
}

const compressed = new Map(); // `${file}:${encoding}` → Buffer (the build is immutable while this process runs)

function send(req, res, status, file, urlPath) {
  const ext = path.extname(file).toLowerCase();
  const headers = { ...SECURITY_HEADERS, 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cacheControlFor(urlPath) };
  let body = fs.readFileSync(file);
  if (COMPRESSIBLE.has(ext) && body.length > 1024) {
    const accept = String(req.headers['accept-encoding'] || '');
    const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
    if (encoding) {
      const key = `${file}:${encoding}`;
      if (!compressed.has(key)) {
        compressed.set(key, encoding === 'br' ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : zlib.gzipSync(body, { level: 9 }));
      }
      body = compressed.get(key);
      headers['Content-Encoding'] = encoding;
    }
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function json(res, status, value, extra = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...extra });
  res.end(body);
}

async function forwardWebhook(req, res, urlPath) {
  if (!API_ORIGIN) return json(res, 404, { error: 'Not found' });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > WEBHOOK_MAX_BYTES) return json(res, 413, { error: 'Too large' });
    chunks.push(chunk);
  }
  try {
    const upstream = await fetch(`${API_ORIGIN}${urlPath}`, {
      method: 'POST',
      // Stripe signs the raw body; pass it through byte for byte with its signature
      headers: Object.fromEntries(
        ['content-type', 'stripe-signature', 'user-agent'].filter(h => req.headers[h]).map(h => [h, String(req.headers[h])]),
      ),
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(text);
  } catch (err) {
    console.error('webhook forward failed', String(err));
    json(res, 502, { error: 'Upstream unavailable' }); // Stripe retries
  }
}

export function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const p = url.pathname;

  if (p === '/health') return json(res, 200, { status: 'ok' });

  // App-link files must answer on every associated host without a redirect (Apple's rule), and a redirected
  // webhook POST would lose its body, so only page loads move to the canonical host.
  const host = String(req.headers.host || '').toLowerCase().split(':')[0];
  const exempt = p.startsWith('/.well-known/') || p === '/webhook' || p.startsWith('/webhook/');
  if (CANONICAL_HOST && host && host !== CANONICAL_HOST && !exempt && !host.endsWith('.railway.app') && !host.endsWith('.railway.internal')) {
    res.writeHead(301, { Location: `https://${CANONICAL_HOST}${url.pathname}${url.search}` });
    return res.end();
  }

  if ((p === '/webhook' || p.startsWith('/webhook/')) && req.method === 'POST') return void forwardWebhook(req, res, p);
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });

  if (p.startsWith('/.well-known/')) {
    const doc = wellKnown(p.slice('/.well-known/'.length));
    return doc ? json(res, 200, doc, { 'Cache-Control': 'public, max-age=3600' }) : json(res, 404, { error: 'Not found' });
  }
  if (p === '/api' || p.startsWith('/api/')) return json(res, 404, { error: 'The API moved; update the app.' });

  const file = fileFor(p);
  if (file) return send(req, res, 200, file, p);
  // A missing build file is a real 404; any other path is an app route
  if (p.startsWith('/_expo/') || p.startsWith('/assets/')) return json(res, 404, { error: 'Not found' });
  const index = path.join(ROOT, 'index.html');
  if (!fs.existsSync(index)) return json(res, 503, { error: 'Web build missing' });
  return send(req, res, 200, index, '/index.html');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  http.createServer(handler).listen(PORT, () => console.log(`Christ Link web on :${PORT} from ${ROOT}${API_ORIGIN ? `, webhooks → ${API_ORIGIN}` : ''}`));
}
