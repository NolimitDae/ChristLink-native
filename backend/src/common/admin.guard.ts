import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Runs after the global JwtAuthGuard. Use through the @Admin() decorator. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const userId: string | undefined = ctx.switchToHttp().getRequest().user?.id;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    const profile = await this.prisma.profiles.findUnique({ where: { id: userId }, select: { role: true } });
    if (profile?.role !== 'admin') throw new ForbiddenException('Admin access required.');
    return true;
  }
}
