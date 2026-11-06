import { otpEmail } from './email.service';

describe('otpEmail', () => {
  const saved = process.env.EMAIL_LOGO_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.EMAIL_LOGO_URL;
    else process.env.EMAIL_LOGO_URL = saved;
  });

  it('uses a text header when no logo is configured', () => {
    delete process.env.EMAIL_LOGO_URL;
    const { html, text, subject } = otpEmail('123456');
    expect(html).not.toContain('<img');
    expect(html).toContain('Christ Link Social');
    expect(html).toContain('123456');
    expect(text).toContain('123456');
    expect(subject).toBe('Your Christ Link Social code is 123456');
  });

  it('shows the hosted logo when EMAIL_LOGO_URL is set', () => {
    process.env.EMAIL_LOGO_URL = 'https://christlinksocial.com/brand/logo-email.png';
    const { html } = otpEmail('123456');
    expect(html).toContain('<img src="https://christlinksocial.com/brand/logo-email.png"');
    expect(html).toContain('alt="Christ Link Social"');
  });
});
