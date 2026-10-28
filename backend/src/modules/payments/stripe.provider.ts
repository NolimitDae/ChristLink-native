import Stripe from 'stripe';
import appConfig from '../../config/app.config';

/** Inject with `@Inject(STRIPE) stripe: Stripe`. Tests override this provider with a mock (no network). */
export const STRIPE = 'STRIPE';

export const stripeProvider = {
  provide: STRIPE,
  // Same API version as server.js. Stripe's SDK retries only safe failures and reuses our idempotency keys.
  useFactory: () => new Stripe(appConfig().stripe.secret_key || 'sk_test_placeholder', { apiVersion: '2024-04-10' }),
};
