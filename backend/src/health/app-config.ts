import appConfig from '../config/app.config';
import { parseServiceAccount } from '../modules/payments/google-wallet';
import { HOST_LISTING_FEE } from '../modules/payments/fees';

/**
 * Which optional features this server can do, so the app hides buttons that would only fail (App Review taps every
 * button). Public and secret-free: only yes/no flags and the listing fee price.
 */
export function appCapabilities() {
  const apple = appConfig().apple_wallet;
  return {
    apple_wallet: !!(apple.p12_base64 && (process.env.APPLE_PASS_P12_PASSWORD || apple.password)),
    google_wallet: !!(appConfig().google_wallet.issuer_id && parseServiceAccount(appConfig().google_wallet.key_json_base64)),
    flyer_reading: !!process.env.ANTHROPIC_API_KEY,
    listing_fee_cents: HOST_LISTING_FEE,
  };
}
