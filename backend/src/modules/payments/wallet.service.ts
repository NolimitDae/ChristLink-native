import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import * as forge from 'node-forge';
import JSZip = require('jszip');
import { PrismaService } from '../../prisma/prisma.service';
import appConfig from '../../config/app.config';
import { isUuid, JsonError } from './json-error';
import { piShortCode } from './tickets.service';

const LINK_TTL_SECONDS = 600;
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** HMAC over ticket id + expiry (prefixed so it can never double as another token signed with JWT_SECRET). */
export function walletSignature(ticketId: string, exp: number, secret = appConfig().auth.jwt_secret ?? '') {
  return createHmac('sha256', secret).update(`wallet-pass:${ticketId}:${exp}`).digest('base64url');
}

export function walletSignatureValid(ticketId: string, exp: unknown, sig: unknown, now = Date.now(), secret?: string) {
  const expNum = Number(exp);
  if (!Number.isInteger(expNum) || expNum * 1000 < now || typeof sig !== 'string') return false;
  const expected = Buffer.from(walletSignature(ticketId, expNum, secret));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function signManifest(manifestJson: string, p12Base64: string, p12Password: string): Buffer {
  const p12Der = Buffer.from(p12Base64, 'base64');
  const p12Asn1 = forge.asn1.fromDer(p12Der.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);
  let certPem: string | null = null;
  let keyPem: string | null = null;
  for (const safeContent of p12.safeContents) {
    for (const bag of safeContent.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert) certPem = forge.pki.certificateToPem(bag.cert);
      if ((bag.type === forge.pki.oids.pkcs8ShroudedKeyBag || bag.type === forge.pki.oids.keyBag) && bag.key) {
        keyPem = forge.pki.privateKeyToPem(bag.key);
      }
    }
  }
  if (!certPem || !keyPem) throw new Error('Could not extract cert/key from P12.');
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestJson, 'utf8');
  p7.addCertificate(certPem);
  p7.addSigner({
    key: keyPem,
    certificate: certPem,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // forge accepts a Date here at runtime; its types say string
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

/** Apple Wallet .pkpass, same pass.json, files and signature as server.js. */
@Injectable()
export class WalletService {
  private readonly logger = new Logger('Wallet');

  constructor(private readonly prisma: PrismaService) {}

  private findTicket(ticketId: string, userId: string | null) {
    if (!isUuid(ticketId)) return null;
    return this.prisma.tickets.findFirst({
      where: { id: ticketId, status: 'confirmed', ...(userId ? { user_id: userId } : {}) },
      include: {
        events: { select: { name: true, start_date: true, end_date: true, venue_name: true, city: true, state: true, cover_url: true } },
        ticket_types: { select: { name: true } },
      },
    });
  }

  /** Signed 10-minute link for Safari / Wallet, which can't send an Authorization header. Owner only. */
  async link(ticketId: string, userId: string, baseUrl: string) {
    if (!(await this.findTicket(ticketId, userId))) throw new NotFoundException('Ticket not found or not confirmed.');
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    return { url: `${baseUrl}/api/tickets/${ticketId}/wallet.pkpass?exp=${exp}&sig=${walletSignature(ticketId, exp)}` };
  }

  checkLink(ticketId: string, exp: unknown, sig: unknown) {
    if (!walletSignatureValid(ticketId, exp, sig)) throw new ForbiddenException('This wallet link has expired. Please try again.');
  }

  /** userId null = already authorized by a signed link. */
  async build(ticketId: string, userId: string | null): Promise<{ buffer: Buffer; shortCode: string }> {
    const ticket = await this.findTicket(ticketId, userId);
    if (!ticket) throw new NotFoundException('Ticket not found or not confirmed.');

    const p12Base64 = appConfig().apple_wallet.p12_base64;
    // server.js read APPLE_PASS_P12_PASSWORD; .env.example / BACKEND.md say APPLE_PASS_PASSWORD. Accept both.
    const p12Password = process.env.APPLE_PASS_P12_PASSWORD || appConfig().apple_wallet.password;
    const passTypeId = appConfig().apple_wallet.pass_type_id || 'pass.com.christlink.tickets';
    const teamId = appConfig().apple_wallet.team_id || 'QKP52JF8KD';
    if (!p12Base64 || !p12Password) throw new JsonError(503, { error: 'Apple Wallet not configured on this server.' });

    try {
      const ev = ticket.events ?? ({} as NonNullable<typeof ticket.events>);
      const shortCode = piShortCode(ticket);
      const eventName = ev.name || 'Christ Link Event';
      const venueName = ev.venue_name || (ev.city ? `${ev.city}${ev.state ? ', ' + ev.state : ''}` : 'See event details');
      const startDate = ev.start_date ? new Date(ev.start_date) : new Date();
      const fmtDate = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const barcode = {
        message: JSON.stringify({ ticketId: ticket.id, code: shortCode, eventId: ticket.event_id }),
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: shortCode,
      };
      const passJson = {
        formatVersion: 1,
        passTypeIdentifier: passTypeId,
        serialNumber: ticket.id,
        teamIdentifier: teamId,
        organizationName: 'Christ Link',
        description: eventName,
        logoText: 'Christ Link',
        foregroundColor: 'rgb(240, 235, 224)',
        backgroundColor: 'rgb(10, 10, 15)',
        labelColor: 'rgb(201, 168, 76)',
        relevantDate: startDate.toISOString(),
        barcode,
        barcodes: [barcode],
        eventTicket: {
          primaryFields: [{ key: 'event', label: 'EVENT', value: eventName }],
          secondaryFields: [
            { key: 'date', label: 'DATE', value: fmtDate },
            { key: 'qty', label: 'TICKETS', value: String(ticket.quantity || 1) },
          ],
          auxiliaryFields: [
            { key: 'venue', label: 'LOCATION', value: venueName },
            { key: 'type', label: 'TYPE', value: ticket.ticket_types?.name || 'General Admission' },
          ],
          backFields: [
            { key: 'ticketid', label: 'Ticket ID', value: ticket.id },
            { key: 'code', label: 'Confirmation', value: shortCode },
            { key: 'email', label: 'Registered To', value: ticket.buyer_email || '' },
            { key: 'terms', label: 'Terms', value: 'This ticket is non-transferable. Present QR code at entry. Issued by Christ Link.' },
          ],
        },
      };

      const files: Record<string, Buffer> = {
        'pass.json': Buffer.from(JSON.stringify(passJson)),
        'icon.png': TRANSPARENT_PNG,
        'icon@2x.png': TRANSPARENT_PNG,
        'logo.png': TRANSPARENT_PNG,
        'logo@2x.png': TRANSPARENT_PNG,
      };
      const zip = new JSZip();
      const manifest: Record<string, string> = {};
      for (const [name, buf] of Object.entries(files)) {
        zip.file(name, buf);
        manifest[name] = createHash('sha1').update(buf).digest('hex');
      }
      const manifestStr = JSON.stringify(manifest);
      zip.file('manifest.json', manifestStr);
      zip.file('signature', signManifest(manifestStr, p12Base64, p12Password));
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      return { buffer, shortCode };
    } catch (e) {
      this.logger.error(`Wallet generation error: ${(e as Error).message}`);
      throw new JsonError(500, { error: 'Failed to generate pass. ' + (e as Error).message });
    }
  }
}
