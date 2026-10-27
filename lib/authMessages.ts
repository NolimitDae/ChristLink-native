/** Turns Supabase Auth errors into short, human messages for the sign-in screen. */

export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

export function authErrorMessage(err: unknown): string {
  const e = (err ?? {}) as AuthErrorLike;
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Wrong email or password. Try again, or create an account.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (code === 'email_not_confirmed') {
    return 'Please confirm your email first, then sign in.';
  }
  if (code === 'weak_password') {
    return e.message || 'Choose a stronger password.';
  }
  if (code.startsWith('over_') || e.status === 429 || msg.includes('rate limit')) {
    return 'Too many tries. Please wait a minute and try again.';
  }
  if (code === 'email_address_not_authorized' || msg.includes('email address not authorized') || msg.includes('error sending')) {
    return "We couldn't send email to this address right now. Sign in with your password instead.";
  }
  if (code === 'signup_disabled') {
    return 'New accounts are closed right now.';
  }
  if (msg.includes('network request failed') || msg.includes('fetch')) {
    return 'No connection. Check your internet and try again.';
  }
  return e.message || 'Something went wrong. Please try again.';
}
