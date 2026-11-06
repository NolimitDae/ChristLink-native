// node --test web/   (npm run test:web)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-web-'));
fs.mkdirSync(path.join(root, '_expo/static/js/web'), { recursive: true });
fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><title>Christ Link Social</title>${' '.repeat(2000)}`);
fs.writeFileSync(path.join(root, '_expo/static/js/web/entry-abc123.js'), `console.log("app");${'x'.repeat(5000)}`);
fs.writeFileSync(path.join(os.tmpdir(), 'cl-secret.txt'), 'secret');

let api; // fake API receiving forwarded webhooks
let apiHits = [];
let web;
let base;

before(async () => {
  api = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      apiHits.push({ url: req.url, sig: req.headers['stripe-signature'], body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"received":true}');
    });
  });
  await new Promise(r => api.listen(0, r));
  process.env.WEB_ROOT = root;
  process.env.API_ORIGIN = `http://127.0.0.1:${api.address().port}`;
  process.env.APPLE_TEAM_ID = 'ABCDE12345';
  process.env.CANONICAL_HOST = 'christlinksocial.com';
  const { handler } = await import('./server.mjs');
  web = http.createServer(handler);
  await new Promise(r => web.listen(0, r));
  base = `http://127.0.0.1:${web.address().port}`;
});

after(() => {
  web.close();
  api.close();
});

/** Raw request (fetch can't set Host). Resolves to a fetch-like response. */
function request(p, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${p}`, { method, headers: { host: 'christlinksocial.com', ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = res.headers['content-encoding'];
        const plain = enc === 'br' ? zlib.brotliDecompressSync(buf) : enc === 'gzip' ? zlib.gunzipSync(buf) : buf;
        resolve({
          status: res.statusCode,
          headers: { get: h => res.headers[h.toLowerCase()] ?? null },
          text: async () => plain.toString(),
          json: async () => JSON.parse(plain.toString()),
        });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
const get = (p, headers = {}) => request(p, { headers });

test('app routes get index.html, revalidated', async () => {
  for (const p of ['/', '/event/123', '/user/abc', '/tickets?payment_intent=pi_1']) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.match(await res.text(), /Christ Link Social/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  }
});

test('hashed build files are cached forever and compressed', async () => {
  const res = await get('/_expo/static/js/web/entry-abc123.js', { 'accept-encoding': 'br, gzip' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(res.headers.get('content-encoding'), 'br');
  assert.match(await res.text(), /console\.log/);
  assert.equal((await get('/_expo/static/js/web/missing.js')).status, 404);
});

test('never serves files outside the build', async () => {
  for (const p of ['/../cl-secret.txt', '/%2e%2e/cl-secret.txt', '/..%2fcl-secret.txt', '/%00']) {
    const res = await get(p);
    assert.doesNotMatch(await res.text(), /secret/, p);
  }
});

test('security headers', async () => {
  const res = await get('/');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('strict-transport-security'), /max-age=/);
});

test('app link files come from env', async () => {
  const aasa = await get('/.well-known/apple-app-site-association');
  assert.equal(aasa.status, 200);
  assert.match(aasa.headers.get('content-type'), /application\/json/);
  const body = await aasa.json();
  assert.deepEqual(body.applinks.details[0].appIDs, ['ABCDE12345.com.christlink.app']);
  // No fingerprint configured: 404 rather than a placeholder
  assert.equal((await get('/.well-known/assetlinks.json')).status, 404);
});

test('Stripe webhooks pass through byte for byte with their signature', async () => {
  apiHits = [];
  const raw = '{"id":"evt_1","type":"payment_intent.succeeded"}';
  const res = await request('/webhook', {
    method: 'POST',
    // www host: webhooks must not be redirected
    headers: { host: 'www.christlinksocial.com', 'content-type': 'application/json', 'stripe-signature': 't=1,v1=abc' },
    body: raw,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true });
  assert.deepEqual(apiHits, [{ url: '/webhook', sig: 't=1,v1=abc', body: raw }]);
});

test('old /api calls get a clear 404, other methods 405', async () => {
  const res = await get('/api/events');
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /moved/);
  assert.equal((await request('/', { method: 'POST' })).status, 405);
});

test('www and other hosts redirect to the canonical domain; health always answers', async () => {
  const res = await get('/event/1?x=2', { host: 'www.christlinksocial.com' });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://christlinksocial.com/event/1?x=2');
  assert.equal((await get('/', { host: 'christlink-web-production.up.railway.app' })).status, 200);
  assert.equal((await get('/health', { host: 'anything.example' })).status, 200);
  // Apple fetches the association file on www too: no redirect
  assert.equal((await get('/.well-known/apple-app-site-association', { host: 'www.christlinksocial.com' })).status, 200);
});
