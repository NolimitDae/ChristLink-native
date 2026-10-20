import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Public } from '../../common/auth.decorators';
import { AuthService } from './auth.service';

// server.js authLimiter: 10 requests per 15 minutes per IP
const AUTH_LIMIT = { long: { limit: 10, ttl: 15 * 60_000 } };

// Loose server.js-shaped bodies (plain interfaces): the service validates and normalizes them.
interface EmailBody {
  email?: string;
  fullName?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(200)
  @Throttle(AUTH_LIMIT)
  async signup(@Body() body: EmailBody) {
    await this.auth.sendCode(body?.email, body?.fullName);
    return { success: true, message: 'Check your email for a 6-digit code.' };
  }

  @Public()
  @Post('signin')
  @HttpCode(200)
  @Throttle(AUTH_LIMIT)
  async signin(@Body() body: EmailBody) {
    await this.auth.sendCode(body?.email);
    return { success: true, message: 'Check your email for a verification code.' };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(200)
  @Throttle(AUTH_LIMIT)
  verify(@Body() body: { email?: string; token?: string }) {
    return this.auth.verifyOtp(body?.email, body?.token);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { refreshToken?: string }) {
    return this.auth.refresh(body?.refreshToken);
  }

  @Public()
  @Post('signout')
  @HttpCode(200)
  signout(@Body() body: { refreshToken?: string }) {
    return this.auth.signout(body?.refreshToken);
  }

  /** Who the access token belongs to (handy for clients and the e2e test). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
