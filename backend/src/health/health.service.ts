import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '../redis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger('Health');

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Status + body for /health. Errors are logged, never returned to the caller. */
  async report(): Promise<{ status: number; body: Record<string, string> }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      return { status: 200, body: { status: 'ok', service: 'christlink', ts: new Date().toISOString() } };
    } catch (error) {
      this.logger.error(`Health check failed: ${(error as Error).message}`);
      return { status: 503, body: { status: 'degraded' } };
    }
  }
}
