import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { REDIS } from './redis';
import Redis from 'ioredis';
import { CoreModule } from './core.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    CoreModule,
    // Counts live in Redis so every API instance shares them. Keyed by req.ip (real client IP: trust proxy = 1).
    ThrottlerModule.forRootAsync({
      inject: [REDIS],
      useFactory: (redis: Redis) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 10_000, limit: 50 },
          { name: 'long', ttl: 60_000, limit: 200 },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    // Feature modules (src/modules/<name>/<name>.module.ts) go here
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
