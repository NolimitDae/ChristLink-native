import { walletSignature, walletSignatureValid } from './wallet.service';

describe('wallet link signature', () => {
  const secret = 's'.repeat(32);
  const now = 1_700_000_000_000;
  const exp = now / 1000 + 600;
  const sig = walletSignature('t1', exp, secret);

  it('accepts a fresh link for the same ticket', () => expect(walletSignatureValid('t1', String(exp), sig, now, secret)).toBe(true));
  it('rejects expired links', () => expect(walletSignatureValid('t1', exp, sig, (exp + 1) * 1000, secret)).toBe(false));
  it('rejects another ticket or a changed expiry', () => {
    expect(walletSignatureValid('t2', exp, sig, now, secret)).toBe(false);
    expect(walletSignatureValid('t1', exp + 60, sig, now, secret)).toBe(false);
  });
  it('rejects junk', () => {
    expect(walletSignatureValid('t1', 'abc', sig, now, secret)).toBe(false);
    expect(walletSignatureValid('t1', exp, undefined, now, secret)).toBe(false);
  });
});
