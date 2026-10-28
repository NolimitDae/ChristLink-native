import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import appConfig from '../../config/app.config';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export interface PutDataUrlOptions {
  maxBytes?: number;
  /** Allowed mime types; defaults to jpeg, png, webp, heic. */
  allowed?: string[];
}

/** Cloudflare R2 through the S3 API. Public files are served from R2_PUBLIC_URL. */
@Injectable()
export class StorageService {
  private client?: S3Client;

  private s3(): S3Client {
    const r2 = appConfig().r2;
    if (!r2.account_id || !r2.access_key_id || !r2.secret_access_key || !r2.bucket) {
      throw new Error('R2 storage is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${r2.account_id}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.access_key_id, secretAccessKey: r2.secret_access_key },
    });
    return this.client;
  }

  /** Validates a `data:<mime>;base64,...` upload and stores it at `<prefix>/<ownerId>/<uuid>.<ext>`. Returns the public URL. */
  async putDataUrl(prefix: string, ownerId: string, dataUrl: unknown, opts: PutDataUrlOptions = {}): Promise<string> {
    const { buffer, type } = parseDataUrl(dataUrl, opts);
    const key = `${prefix}/${ownerId}/${randomUUID()}.${IMAGE_TYPES[type] ?? type.split('/')[1]}`;
    await this.put(key, buffer, type, 'public, max-age=31536000, immutable');
    return `${appConfig().r2.public_url}/${key}`;
  }

  /** Stores a file that is only readable through signedGetUrl (e.g. `private/id-docs/...`). Returns the key. */
  async putPrivate(key: string, buffer: Buffer, type: string): Promise<string> {
    await this.put(key, buffer, type, 'private, no-store');
    return key;
  }

  async signedGetUrl(key: string, seconds = 300): Promise<string> {
    return getSignedUrl(this.s3(), new GetObjectCommand({ Bucket: appConfig().r2.bucket, Key: key }), {
      expiresIn: seconds,
    });
  }

  private async put(key: string, body: Buffer, type: string, cacheControl: string) {
    await this.s3().send(
      new PutObjectCommand({
        Bucket: appConfig().r2.bucket,
        Key: key,
        Body: body,
        ContentType: type,
        CacheControl: cacheControl,
      }),
    );
  }
}

const mb = (bytes: number) => `${Math.round(bytes / 1048576)}MB`;

/** Trust boundary: checks the declared type against the allow-list, the size, and the file's magic bytes. */
export function parseDataUrl(
  dataUrl: unknown,
  { maxBytes = 5 * 1024 * 1024, allowed = Object.keys(IMAGE_TYPES) }: PutDataUrlOptions = {},
) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new BadRequestException('Invalid image data.');
  const match = dataUrl.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new BadRequestException('Bad data URL format.');
  const type = match[1].toLowerCase();
  if (!allowed.includes(type)) throw new BadRequestException('Unsupported file type.');
  // Reject before decoding a huge string: base64 is 4 chars per 3 bytes
  if (match[2].length * 0.75 > maxBytes + 3) throw new PayloadTooLargeException(`File must be under ${mb(maxBytes)}.`);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new BadRequestException('Invalid image data.');
  if (buffer.length > maxBytes) throw new PayloadTooLargeException(`File must be under ${mb(maxBytes)}.`);
  if (!matchesMagicBytes(type, buffer)) throw new BadRequestException('File content does not match its type.');
  return { buffer, type };
}

function matchesMagicBytes(type: string, b: Buffer): boolean {
  switch (type) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8;
    case 'image/png':
      return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    case 'image/webp':
      return b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'image/heic':
      return b.subarray(4, 8).toString('ascii') === 'ftyp';
    default:
      return true;
  }
}
