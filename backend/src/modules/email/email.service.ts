import { Injectable, Logger } from '@nestjs/common';
import appConfig from '../../config/app.config';
import type { EmailJob } from '../../queues/queues';

/** Sends through Resend's HTTP API. Without RESEND_API_KEY (local dev) the email is logged instead. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');

  async send({ to, subject, html, text }: EmailJob): Promise<void> {
    const { resend_api_key, from } = appConfig().email;
    if (!resend_api_key) {
      this.logger.warn(`[dev] RESEND_API_KEY not set. Email to ${to}: ${subject}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Branded one-time-code email (HTML + plain text). */
export function otpEmail(code: string): Omit<EmailJob, 'to'> {
  const line = `Your Christ Link Social code is ${code}`;
  const note = "It expires in 10 minutes. If you didn't ask for it, you can ignore this email.";
  const text = `${line}\n\n${note}\n\nChrist Link Social`;
  const html = `<!doctype html><html><body style="margin:0;background:#F7F3EA;font-family:Helvetica,Arial,sans-serif;color:#1A1714">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:440px;background:#FFFDF8;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:22px;padding-bottom:16px">Christ Link Social</td></tr>
<tr><td style="font-size:15px;line-height:22px;padding-bottom:20px">${escapeHtml(line)}.</td></tr>
<tr><td style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#8A6A1F;padding-bottom:20px">${escapeHtml(code)}</td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6B6358">${escapeHtml(note)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: line, html, text };
}
