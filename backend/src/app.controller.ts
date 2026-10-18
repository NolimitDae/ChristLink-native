import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { SkipThrottle } from '@nestjs/throttler';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // Railway healthcheck: only report healthy once Postgres and Redis both answer
  @SkipThrottle()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
    } catch (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
