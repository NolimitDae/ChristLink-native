import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService, otpEmail } from '../email/email.service';
import { OtpService } from './otp.service';

export const ACCESS_TOKEN_SECONDS = 3600;
export const REFRESH_TOKEN_DAYS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function normalizeEmail(email: unknown): string {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!e) throw new BadRequestException('Email is required.');
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new BadRequestException('Enter a valid email address.');
  return e;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly email: EmailService,
  ) {}

  private isReviewAccount(email: string) {
    const { review_email, review_code } = appConfig().auth;
    return !!review_email && !!review_code && email === review_email;
  }

  async sendCode(rawEmail: unknown, fullName?: unknown) {
    const email = normalizeEmail(rawEmail);
    if (this.isReviewAccount(email)) return; // reviewer uses the fixed REVIEW_CODE
    const name = typeof fullName === 'string' ? fullName.trim().slice(0, 120) : undefined;
    const code = await this.otp.issue(email, name || undefined);
    if (!appConfig().email.resend_api_key) {
      this.logger.warn(`[dev] Sign-in code for ${email}: ${code}`);
      return;
    }
    await this.email.send({ to: email, ...otpEmail(code) });
  }

  async verifyOtp(rawEmail: unknown, token: unknown) {
    if (!rawEmail || !token) throw new BadRequestException('Email and code are required.');
    const email = normalizeEmail(rawEmail);
    const code = String(token).trim();
    const isReview = this.isReviewAccount(email) && safeEqual(code, appConfig().auth.review_code!);
    const { fullName } = isReview ? { fullName: undefined } : await this.otp.verify(email, code);

    const user = await this.findOrCreateUser(email, fullName);
    const tokens = await this.issueTokens(user.id, user.email);
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    return { success: true, ...tokens, user: { id: user.id, email: user.email, profile } };
  }

  /** First verify creates users + profiles, like Supabase's handle_new_user trigger. */
  private async findOrCreateUser(email: string, fullName?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.users.upsert({
        where: { email },
        create: { email, last_sign_in_at: new Date() },
        update: { last_sign_in_at: new Date() },
      });
      const existing = await tx.profiles.findUnique({ where: { id: user.id }, select: { id: true } });
      if (!existing) {
        await tx.profiles.create({ data: { id: user.id, email, full_name: fullName || email.split('@')[0] } });
      }
      return user;
    });
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    const refreshToken = randomBytes(32).toString('base64url');
    const row = await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: hashToken(refreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS, refreshTokenId: row.id };
  }

  /** Rotates the refresh token. Presenting an already-rotated token revokes every token issued after it. */
  async refresh(refreshToken: unknown) {
    if (!refreshToken || typeof refreshToken !== 'string') throw new BadRequestException('Refresh token required.');
    const expired = new UnauthorizedException('Session expired. Please sign in again.');
    const row = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: hashToken(refreshToken) },
      include: { users: { select: { email: true } } },
    });
    if (!row) throw expired;
    if (row.revoked_at) {
      await this.revokeChain(row.replaced_by);
      this.logger.warn(`Refresh token reuse detected for user ${row.user_id}; revoked its chain`);
      throw expired;
    }
    if (row.expires_at < new Date()) throw expired;

    const { refreshTokenId, ...tokens } = await this.issueTokens(row.user_id, row.users.email);
    // Conditional update: if two requests race with the same token, only one wins; the loser counts as reuse.
    const { count } = await this.prisma.refresh_tokens.updateMany({
      where: { id: row.id, revoked_at: null },
      data: { revoked_at: new Date(), replaced_by: refreshTokenId },
    });
    if (count === 0) {
      await this.revokeChain(refreshTokenId);
      throw expired;
    }
    return tokens;
  }

  private async revokeChain(startId: string | null) {
    const seen = new Set<string>();
    for (let id = startId; id && !seen.has(id); ) {
      seen.add(id);
      const next = await this.prisma.refresh_tokens.findUnique({ where: { id }, select: { replaced_by: true } });
      await this.prisma.refresh_tokens.updateMany({ where: { id, revoked_at: null }, data: { revoked_at: new Date() } });
      id = next?.replaced_by ?? null;
    }
  }

  async signout(refreshToken: unknown) {
    if (typeof refreshToken === 'string' && refreshToken) {
      await this.prisma.refresh_tokens.updateMany({
        where: { token_hash: hashToken(refreshToken), revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return { success: true };
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
