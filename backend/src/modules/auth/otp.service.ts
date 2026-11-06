import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRedis } from '../../redis';
import Redis from 'ioredis';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import appConfig from '../../config/app.config';

export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

const key = (kind: 'code' | 'attempts' | 'cooldown' | 'name', email: string) => `otp:${kind}:${email}`;

/** 6-digit email codes, stored only as an HMAC in Redis. */
@Injectable()
export class OtpService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  hash(email: string, code: string): string {
    return createHmac('sha256', appConfig().auth.jwt_secret || 'dev').update(`${email}:${code}`).digest('hex');
  }

  /** Creates and stores a new code. Throws 429 if one was sent to this email in the last 60 s. */
  async issue(email: string, fullName?: string): Promise<string> {
    const ok = await this.redis.set(key('cooldown', email), '1', 'EX', OTP_RESEND_SECONDS, 'NX');
    if (!ok) throw new HttpException('Please wait a minute before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const multi = this.redis
      .multi()
      .set(key('code', email), this.hash(email, code), 'EX', OTP_TTL_SECONDS)
      .set(key('attempts', email), '0', 'EX', OTP_TTL_SECONDS);
    if (fullName) multi.set(key('name', email), fullName, 'EX', OTP_TTL_SECONDS);
    await multi.exec();
    return code;
  }

  /**
   * Checks a code. Every check counts as an attempt (atomic INCR), so parallel guesses can't exceed the limit.
   * Returns the signup fullName (if any) on success; throws 400 otherwise. A used code is deleted.
   */
  async verify(email: string, code: string): Promise<{ fullName?: string }> {
    const stored = await this.redis.get(key('code', email));
    if (!stored) throw new HttpException('Invalid or expired code. Please try again.', HttpStatus.BAD_REQUEST);
    const attempts = await this.redis.incr(key('attempts', email));
    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.redis.del(key('code', email), key('attempts', email));
      throw new HttpException('Too many attempts. Please request a new code.', HttpStatus.BAD_REQUEST);
    }
    const given = Buffer.from(this.hash(email, code));
    if (given.length !== stored.length || !timingSafeEqual(given, Buffer.from(stored))) {
      throw new HttpException('Invalid or expired code. Please try again.', HttpStatus.BAD_REQUEST);
    }
    const [, , [, fullName]] = (await this.redis
      .multi()
      .del(key('code', email))
      .del(key('attempts', email))
      .get(key('name', email))
      .del(key('name', email))
      .exec()) as [unknown, unknown, [unknown, string | null], unknown];
    return { fullName: fullName || undefined };
  }
}
