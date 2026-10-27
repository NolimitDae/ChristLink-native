import { authErrorMessage } from '../../lib/authMessages';
import { newPasswordSchema } from '../../lib/validation';

describe('authErrorMessage', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Wrong email or password'],
    [{ message: 'Invalid login credentials' }, 'Wrong email or password'],
    [{ code: 'user_already_exists' }, 'already exists'],
    [{ message: 'User already registered' }, 'already exists'],
    [{ code: 'email_not_confirmed' }, 'confirm your email'],
    [{ code: 'over_email_send_rate_limit' }, 'Too many tries'],
    [{ status: 429, message: 'x' }, 'Too many tries'],
    [{ code: 'email_address_not_authorized' }, 'Sign in with your password'],
    [{ message: 'Error sending magic link email' }, 'Sign in with your password'],
    [{ code: 'signup_disabled' }, 'closed'],
    [{ message: 'Network request failed' }, 'No connection'],
  ])('maps %j', (err, expected) => {
    expect(authErrorMessage(err)).toContain(expected);
  });

  it('keeps the server message for weak passwords', () => {
    expect(authErrorMessage({ code: 'weak_password', message: 'Password should contain a number' })).toBe(
      'Password should contain a number',
    );
  });

  it('falls back to the raw message, then a generic one', () => {
    expect(authErrorMessage({ message: 'Odd failure' })).toBe('Odd failure');
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('newPasswordSchema', () => {
  it('needs 8 to 72 characters', () => {
    expect(newPasswordSchema.safeParse('short').success).toBe(false);
    expect(newPasswordSchema.safeParse('longenough').success).toBe(true);
    expect(newPasswordSchema.safeParse('x'.repeat(73)).success).toBe(false);
  });
});
