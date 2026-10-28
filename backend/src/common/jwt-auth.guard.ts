import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC, OPTIONAL_AUTH } from './auth.decorators';

/** Global guard: every route needs `Authorization: Bearer <accessToken>` unless marked @Public / @OptionalAuth. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, targets);

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      if (optional) return true;
      throw new UnauthorizedException('Authentication required.');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(header.slice(7), {
        algorithms: ['HS256'],
      });
      req.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      if (optional) return true;
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
