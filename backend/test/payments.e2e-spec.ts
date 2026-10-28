import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as forge from 'node-forge';
import JSZip = require('jszip');
import Stripe from 'stripe';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { STRIPE } from '../src/modules/payments/stripe.provider';

const WEBHOOK_SECRET = 'whsec_test_platform';
const CONNECT_SECRET = 'whsec_test_connect';
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT_SECRET;
process.env.APP_URL = 'https://app.example.com';
delete process.env.APPLE_PASS_P12_BASE64;

// Stripe mocked: no network. Webhook signing uses the real SDK helpers.
const realStripe = new Stripe('sk_test_x', { apiVersion: '2024-04-10' });
let piCounter = 0;
const intents = new Map<string, any>();
const stripe = {
  webhooks: realStripe.webhooks,
  paymentIntents: {
    create: jest.fn(async (params: any, opts: any) => {
      for (const pi of intents.values()) if (pi.key === opts?.idempotencyKey) return pi;
      const id = `pi_test${++piCounter}`;
      const pi = { id, client_secret: `${id}_secret_x`, status: params.confirm ? 'succeeded' : 'requires_payment_method', key: opts?.idempotencyKey, latest_charge: `ch_${id}` };
      intents.set(id, pi);
      return pi;
    }),
    retrieve: jest.fn(async (id: string) => intents.get(id) ?? Promise.reject(Object.assign(new Error('No such payment_intent'), { type: 'StripeInvalidRequestError' }))),
  },
  refunds: { create: jest.fn(async () => ({ id: 're_test1' })) },
  accounts: {
    create: jest.fn(async () => ({ id: 'acct_new' })),
    retrieve: jest.fn(async (id: string) => ({ id, details_submitted: true, payouts_enabled: true, charges_enabled: true, requirements: { currently_due: [] } })),
    createLoginLink: jest.fn(async () => ({ url: 'https://connect.stripe.com/login' })),
  },
  accountLinks: { create: jest.fn(async () => ({ url: 'https://connect.stripe.com/setup' })) },
  tax: { calculations: { create: jest.fn(async () => Promise.reject(new Error('tax off'))) } },
};

describe('Payments, tickets, refunds, check-in, wallet (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const users: Record<string, { id: string; auth: string }> = {};
  let eventId: string;
  let typeId: string;

  async function makeUser(key: string) {
    const id = randomUUID();
    const email = `payments-e2e+${key}-${id}@example.com`;
    await prisma.users.create({ data: { id, email } });
    await prisma.profiles.create({ data: { id, email, full_name: `User ${key}` } });
    users[key] = { id, auth: `Bearer ${await app.get(JwtService).signAsync({ sub: id, email })}` };
  }
  const as = (key: string) => ({ Authorization: users[key].auth });

  async function waitForNotification(userId: string, type: string) {
    for (let i = 0; i < 40; i++) {
      const n = await prisma.notifications.findFirst({ where: { user_id: userId, type } });
      if (n) return n;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  function webhook(event: object, secret = WEBHOOK_SECRET) {
    const payload = JSON.stringify(event);
    const sig = realStripe.webhooks.generateTestHeaderString({ payload, secret });
    return http.post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', sig).send(payload);
  }
  const sold = async () => (await prisma.ticket_types.findUnique({ where: { id: typeId } })).sold;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(STRIPE).useValue(stripe).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    for (const k of ['host', 'buyer', 'stranger']) await makeUser(k);
    await prisma.host_stripe_accounts.create({ data: { user_id: users.host.id, stripe_account_id: `acct_${users.host.id.slice(0, 8)}`, charges_enabled: true } });
    const ev = await prisma.events.create({
      data: { host_id: users.host.id, name: 'Worship Night', status: 'published', is_paid: true, start_date: new Date(Date.now() + 86_400_000), max_capacity: 100 },
    });
    eventId = ev.id;
    typeId = (await prisma.ticket_types.create({ data: { event_id: eventId, name: 'GA', price_cents: 1500, quantity: 10 } })).id;
  });

  afterAll(async () => {
    await prisma.events.deleteMany({ where: { host_id: users.host?.id } });
    await prisma.users.deleteMany({ where: { email: { startsWith: 'payments-e2e+' } } });
    await prisma.listing_promo_codes.deleteMany({ where: { code: { startsWith: 'E2EPAY' } } });
    await app.close();
  });

  it('price-breakdown matches server.js and never goes negative', async () => {
    await http.get('/api/price-breakdown?price=1500&qty=1&absorb=true').expect(200, { face: 1500, chargeAmount: 1605, platformFee: 105, stripeFee: 77, hostReceives: 1423 });
    await http.get('/api/price-breakdown?price=0').expect(200, { face: 0, chargeAmount: 0, platformFee: 0, stripeFee: 0, hostReceives: 0 });
    await http.get('/api/price-breakdown').expect(400, { error: 'Price required.' });
  });

  it('tax-estimate falls back to zero tax', async () => {
    await http.post('/api/tax-estimate').set(as('buyer')).send({ amountCents: 1605 }).expect(200, { taxAmountCents: 0, totalCents: 1605, calculationId: null });
  });

  let pi1: string;
  it('create-payment-intent → pending ticket; a double tap reuses it', async () => {
    await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId }).expect(400, { error: 'Event ID and ticket type required.' });
    await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 21 }).expect(400);
    const res = await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 1 }).expect(200);
    expect(res.body).toEqual({
      clientSecret: expect.stringMatching(/_secret_/),
      breakdown: { face: 1500, chargeAmount: 1605, platformFee: 105, stripeFee: 77, hostReceives: 1423 },
      intentId: expect.any(String),
      ticketCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
    });
    pi1 = res.body.intentId;
    const [params, opts] = stripe.paymentIntents.create.mock.calls[0];
    expect(params).toMatchObject({ amount: 1605, application_fee_amount: 105, transfer_data: { destination: expect.stringMatching(/^acct_/) } });
    expect(opts.idempotencyKey).toMatch(/^pi-/);

    const again = await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 1 }).expect(200);
    expect(again.body.intentId).toBe(pi1);
    expect(again.body.ticketCode).toBe(res.body.ticketCode);
    expect(await prisma.tickets.count({ where: { stripe_payment_intent: pi1 } })).toBe(1);
  });

  it('confirm-by-intent confirms once, counts the sale and notifies buyer and host', async () => {
    intents.get(pi1).status = 'succeeded';
    const res = await http.post('/api/tickets/confirm-by-intent').set(as('buyer')).send({ paymentIntentId: pi1 }).expect(200);
    expect(res.body).toEqual({ confirmed: true, tickets: [expect.objectContaining({ quantity: 1, event_id: eventId, total_charged_cents: 1605 })] });
    expect(await sold()).toBe(1);
    expect(await waitForNotification(users.buyer.id, 'ticket_confirmed')).toBeTruthy();
    expect(await waitForNotification(users.host.id, 'ticket_sale')).toBeTruthy();
    // Webhook arriving later changes nothing
    const again = await webhook({ id: `evt_${randomUUID()}`, type: 'payment_intent.succeeded', data: { object: { id: pi1, metadata: { ticket_type_id: typeId, qty: '1' } } } }).expect(200);
    expect(again.body).toEqual({ received: true });
    expect(await sold()).toBe(1);
  });

  let pi2: string;
  it('webhook confirms, is idempotent and rejects bad signatures', async () => {
    const res = await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 2 }).expect(200);
    pi2 = res.body.intentId;
    const event = { id: `evt_${randomUUID()}`, type: 'payment_intent.succeeded', data: { object: { id: pi2, metadata: { ticket_type_id: typeId, qty: '2' } } } };
    await webhook(event).expect(200, { received: true });
    await webhook(event).expect(200, { received: true, duplicate: true });
    expect(await sold()).toBe(3);
    const bad = await http.post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=nope').send(JSON.stringify(event)).expect(400);
    expect(bad.text).toMatch(/^Webhook Error:/);
  });

  it('my-tickets returns tickets with event fields', async () => {
    const res = await http.get('/api/my-tickets').set(as('buyer')).expect(200);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.tickets[0]).toMatchObject({ event_name: 'Worship Night', ticket_type_name: 'GA', event_host_id: users.host.id, checked_in: false, checked_in_at: null });
  });

  it('verify checks a ticket in once, host only', async () => {
    const t = await prisma.tickets.findUnique({ where: { stripe_payment_intent: pi1 } });
    await http.post('/api/tickets/verify').set(as('buyer')).send({}).expect(400, { valid: false, error: 'Ticket ID or code required.' });
    await http.post('/api/tickets/verify').set(as('stranger')).send({ ticketId: t.id, eventId }).expect(403, { valid: false, error: 'Only the event host can verify tickets.' });
    // server.js let anyone check in when eventId was omitted
    await http.post('/api/tickets/verify').set(as('stranger')).send({ ticketId: t.id }).expect(403);
    const ok = await http.post('/api/tickets/verify').set(as('host')).send({ ticketId: t.id, eventId, code: t.code, status: 'confirmed' }).expect(200);
    expect(ok.body).toMatchObject({ valid: true, message: '1 ticket checked in successfully.', ticket: { id: t.id, event_name: 'Worship Night', ticket_type_name: 'GA', events: { name: 'Worship Night' } } });
    expect(ok.body.ticket.events.host_id).toBeUndefined();
    const again = await http.post('/api/tickets/verify').set(as('host')).send({ ticketId: t.id, eventId }).expect(200);
    expect(again.body).toMatchObject({ valid: false, error: expect.stringMatching(/^Already checked in at/) });

    // By the ticket's own code
    const t2 = await prisma.tickets.findUnique({ where: { stripe_payment_intent: pi2 } });
    const byCode = await http.post('/api/tickets/verify').set(as('host')).send({ code: t2.code.toLowerCase(), eventId }).expect(200);
    expect(byCode.body).toMatchObject({ valid: true, message: '2 tickets checked in successfully.', ticket: { code: t2.code } });
    const byCodeAgain = await http.post('/api/tickets/verify').set(as('host')).send({ code: t2.code, eventId }).expect(200);
    expect(byCodeAgain.body).toMatchObject({ valid: false, already_checked_in: true });
    await http.post('/api/tickets/verify').set(as('host')).send({ code: 'NOPE1234', eventId }).expect(200, { valid: false, error: 'Ticket not found or not confirmed for this event.' });
  });

  it('attendance is host only', async () => {
    await http.get(`/api/events/${eventId}/attendance`).set(as('host')).expect(200, { total: 2, checked_in: 2, capacity: 100 });
    await http.get(`/api/events/${eventId}/attendance`).set(as('stranger')).expect(403, { error: 'Not your event.' });
  });

  it('refund request → host list → approve refunds through Stripe and notifies', async () => {
    const t = await prisma.tickets.findUnique({ where: { stripe_payment_intent: pi1 } });
    await http.post(`/api/tickets/${t.id}/request-refund`).set(as('stranger')).send({}).expect(404, { error: 'Ticket not found.' });
    const req = await http.post(`/api/tickets/${t.id}/request-refund`).set(as('buyer')).send({ reason: 'Sick <b>' }).expect(200);
    expect(req.body).toEqual({ success: true, requestId: expect.any(String) });
    expect((await waitForNotification(users.host.id, 'refund_request')).body).toContain('Reason: Sick <b>');

    const list = await http.get(`/api/refund-requests?eventId=${eventId}`).set(as('host')).expect(200);
    expect(list.body.requests).toEqual([
      expect.objectContaining({
        id: req.body.requestId,
        status: 'pending',
        reason: 'Sick <b>',
        tickets: { id: t.id, quantity: 1, total_charged_cents: 1605, code: t.code, buyer_email: t.buyer_email },
        events: { id: eventId, name: 'Worship Night' },
        profiles: { full_name: 'User buyer', avatar_url: null, avatar_color: null },
      }),
    ]);

    await http.post(`/api/refund-requests/${req.body.requestId}/approve`).set(as('stranger')).expect(404, { error: 'Request not found.' });
    await http.post(`/api/refund-requests/${req.body.requestId}/approve`).set(as('host')).expect(200, { success: true, refundId: 're_test1' });
    expect(stripe.refunds.create).toHaveBeenLastCalledWith({ charge: `ch_${pi1}` }, { idempotencyKey: `refund-${t.id}` });
    expect((await prisma.tickets.findUnique({ where: { id: t.id } })).status).toBe('refunded');
    expect(await sold()).toBe(2);
    expect(await waitForNotification(users.buyer.id, 'refund_approved')).toBeTruthy();
    await http.post(`/api/refund-requests/${req.body.requestId}/approve`).set(as('host')).expect(400, { error: 'Request already resolved.' });
    // The charge.refunded webhook that follows changes nothing
    await webhook({ id: `evt_${randomUUID()}`, type: 'charge.refunded', data: { object: { id: `ch_${pi1}`, payment_intent: pi1 } } }).expect(200);
    expect(await sold()).toBe(2);
  });

  it('deny notifies the buyer; a dashboard refund (webhook) refunds the ticket', async () => {
    const t = await prisma.tickets.findUnique({ where: { stripe_payment_intent: pi2 } });
    const req = await http.post(`/api/tickets/${t.id}/request-refund`).set(as('buyer')).send({}).expect(200);
    await http.post(`/api/refund-requests/${req.body.requestId}/deny`).set(as('host')).expect(200, { success: true });
    expect(await waitForNotification(users.buyer.id, 'refund_denied')).toBeTruthy();
    expect((await prisma.refund_requests.findUnique({ where: { id: req.body.requestId } })).status).toBe('denied');

    await webhook({ id: `evt_${randomUUID()}`, type: 'charge.refunded', data: { object: { id: `ch_${pi2}`, payment_intent: pi2 } } }).expect(200, { received: true });
    expect((await prisma.tickets.findUnique({ where: { id: t.id } })).status).toBe('refunded');
    expect(await sold()).toBe(0);
    await http.post(`/api/tickets/${t.id}/refund`).set(as('host')).expect(400, { error: 'Only confirmed tickets can be refunded.' });
  });

  it('host refund of a confirmed ticket', async () => {
    const res = await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 1 }).expect(200);
    intents.get(res.body.intentId).status = 'succeeded';
    await http.post('/api/tickets/confirm-by-intent').set(as('buyer')).send({ paymentIntentId: res.body.intentId }).expect(200);
    const t = await prisma.tickets.findUnique({ where: { stripe_payment_intent: res.body.intentId } });
    await http.post(`/api/tickets/${t.id}/refund`).set(as('stranger')).expect(403, { error: 'Only the event host can issue refunds.' });
    await http.post(`/api/tickets/${t.id}/refund`).set(as('host')).expect(200, { success: true, refundId: 're_test1' });
    expect((await prisma.tickets.findUnique({ where: { id: t.id } })).status).toBe('refunded');
  });

  it('a 100% coupon makes the ticket free with no Stripe call', async () => {
    await prisma.coupons.create({ data: { event_id: eventId, host_id: users.host.id, code: 'FREE100', discount_type: 'percent', discount_value: 100 } });
    const calls = stripe.paymentIntents.create.mock.calls.length;
    const res = await http.post('/api/create-payment-intent').set(as('buyer')).send({ eventId, ticketTypeId: typeId, qty: 1, couponCode: 'free100' }).expect(200);
    expect(res.body).toEqual({ free: true, breakdown: { face: 0, chargeAmount: 0, platformFee: 0, stripeFee: 0, hostReceives: 0 }, ticketCode: expect.any(String) });
    expect(stripe.paymentIntents.create.mock.calls.length).toBe(calls);
    expect((await prisma.coupons.findFirst({ where: { event_id: eventId, code: 'FREE100' } })).uses).toBe(1);
  });

  it('listing fee: promo validation, free promo and card charge', async () => {
    await prisma.listing_promo_codes.createMany({
      data: [
        { code: 'E2EPAYFREE', discount_type: 'percent', discount_value: 100 },
        { code: 'E2EPAYHALF', discount_type: 'percent', discount_value: 50, max_uses: 5 },
      ],
    });
    await http.post('/api/validate-listing-promo').set(as('host')).send({ code: 'e2epayhalf' }).expect(200, {
      valid: true,
      promo_id: (await prisma.listing_promo_codes.findUnique({ where: { code: 'E2EPAYHALF' } })).id,
      discount_type: 'percent',
      discount_value: 50,
      discount_cents: 1000,
      final_cents: 999,
    });
    await http.post('/api/validate-listing-promo').set(as('host')).send({ code: 'NOPE' }).expect(404, { error: 'Invalid or expired promo code.' });

    const draft = await prisma.events.create({ data: { host_id: users.host.id, name: 'Paid Draft', is_paid: true } });
    await http.post('/api/charge-listing-fee').set(as('stranger')).send({ eventId: draft.id, paymentMethodId: 'pm_x' }).expect(404);
    await http.post('/api/charge-listing-fee').set(as('host')).send({ eventId: draft.id, paymentMethodId: '__promo_free__', promoCode: 'NOPE' })
      .expect(400, { error: 'Promo code could not be applied. Please re-enter your card details and try again.', resetCard: true });
    await http.post('/api/charge-listing-fee').set(as('host')).send({ eventId: draft.id, paymentMethodId: '__promo_free__', promoCode: 'E2EPAYFREE' }).expect(200, { success: true, intentId: 'promo_free' });
    await http.post('/api/charge-listing-fee').set(as('host')).send({ eventId: draft.id, paymentMethodId: 'pm_card' }).expect(400, { error: 'Listing fee already paid.' });

    const draft2 = await prisma.events.create({ data: { host_id: users.host.id, name: 'Paid Draft 2', is_paid: true } });
    const res = await http.post('/api/charge-listing-fee').set(as('host')).send({ eventId: draft2.id, paymentMethodId: 'pm_card_visa', promoCode: 'E2EPAYHALF' }).expect(200);
    expect(stripe.paymentIntents.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 999, confirm: true, metadata: expect.objectContaining({ type: 'listing_fee', event_id: draft2.id }) }),
      { idempotencyKey: `listing-fee-${draft2.id}-pm_card_visa` },
    );
    expect(await prisma.events.findUnique({ where: { id: draft2.id } })).toMatchObject({ listing_fee_paid: true, listing_payment_id: res.body.intentId });
    expect((await prisma.listing_promo_codes.findUnique({ where: { code: 'E2EPAYHALF' } })).uses_count).toBe(1);
  });

  it('Connect onboard, sync, account.updated (Connect secret) and disconnect', async () => {
    const onboard = await http.post('/api/connect-onboard').set(as('stranger')).expect(200);
    expect(onboard.body).toEqual({ url: 'https://connect.stripe.com/setup', accountId: 'acct_new' });
    expect(stripe.accountLinks.create).toHaveBeenLastCalledWith(expect.objectContaining({ return_url: 'https://app.example.com/?connected=1' }));

    await webhook({ id: `evt_${randomUUID()}`, type: 'account.updated', data: { object: { id: 'acct_new', details_submitted: true, payouts_enabled: false, charges_enabled: true } } }, CONNECT_SECRET).expect(200);
    expect(await prisma.host_stripe_accounts.findUnique({ where: { stripe_account_id: 'acct_new' } })).toMatchObject({ charges_enabled: true, payouts_enabled: false });

    const sync = await http.post('/api/connect-sync').set(as('stranger')).expect(200);
    expect(sync.body).toEqual({ accountId: 'acct_new', onboardingComplete: true, payoutsEnabled: true, chargesEnabled: true, requirements: { currently_due: [] } });
    expect((await prisma.profiles.findUnique({ where: { id: users.stranger.id } })).role).toBe('host');

    const login = await http.post('/api/connect-onboard').set(as('stranger')).expect(200);
    expect(login.body).toEqual({ url: 'https://connect.stripe.com/login', accountId: 'acct_new', alreadyOnboarded: true });

    await http.delete('/api/connect-disconnect').set(as('stranger')).expect(200, { success: true });
    await http.delete('/api/connect-disconnect').set(as('stranger')).expect(404, { error: 'No connected Stripe account found.' });
    await http.post('/api/connect-sync').set(as('stranger')).expect(404, { error: 'No connected account found.' });
  });

  describe('Apple Wallet', () => {
    let ticketId: string;
    beforeAll(async () => {
      ticketId = (await prisma.tickets.findFirst({ where: { user_id: users.buyer.id, status: 'confirmed' } })).id;
    });

    it('returns server.js error when not configured', async () => {
      await http.get(`/api/tickets/${ticketId}/wallet`).set(as('buyer')).expect(503, { error: 'Apple Wallet not configured on this server.' });
      await http.get(`/api/tickets/${ticketId}/wallet`).set(as('stranger')).expect(404, { error: 'Ticket not found or not confirmed.' });
    });

    it('signed link: owner only, works without a token, rejects bad signatures', async () => {
      await http.get(`/api/tickets/${ticketId}/wallet-link`).set(as('stranger')).expect(404);
      const { body } = await http.get(`/api/tickets/${ticketId}/wallet-link`).set(as('buyer')).expect(200);
      const url = new URL(body.url);
      expect(url.pathname).toBe(`/api/tickets/${ticketId}/wallet.pkpass`);
      await http.get(`${url.pathname}?exp=${url.searchParams.get('exp')}&sig=bad`).expect(403);
      await http.get(`${url.pathname}?exp=${Number(url.searchParams.get('exp')) + 1}&sig=${url.searchParams.get('sig')}`).expect(403);

      // A self-signed P12 stands in for Apple's certificate
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date(Date.now() + 86_400_000);
      cert.setSubject([{ name: 'commonName', value: 'test' }]);
      cert.setIssuer([{ name: 'commonName', value: 'test' }]);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' });
      process.env.APPLE_PASS_P12_BASE64 = Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary').toString('base64');
      process.env.APPLE_PASS_PASSWORD = 'pw';
      try {
        const res = await http.get(`${url.pathname}${url.search}`).buffer(true).parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        }).expect(200);
        expect(res.headers['content-type']).toBe('application/vnd.apple.pkpass');
        const zip = await JSZip.loadAsync(res.body);
        expect(Object.keys(zip.files).sort()).toEqual(['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png', 'manifest.json', 'pass.json', 'signature']);
        const pass = JSON.parse(await zip.file('pass.json').async('string'));
        expect(pass).toMatchObject({ serialNumber: ticketId, description: 'Worship Night', eventTicket: { primaryFields: [{ value: 'Worship Night' }] } });
      } finally {
        delete process.env.APPLE_PASS_P12_BASE64;
        delete process.env.APPLE_PASS_PASSWORD;
      }
    });
  });
});
