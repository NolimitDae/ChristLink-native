import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import appConfig from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { InjectRedis, redisProvider, REDIS } from './redis';
import { QUEUE_EMAIL, QUEUE_JOBS, QUEUE_PUSH } from './queues/queues';
import { HealthService } from './health/health.service';
import { EmailService } from './modules/email/email.service';
import { StorageService } from './modules/storage/storage.service';
import { NotificationsService } from './modules/notifications/notifications.service';

const queues = BullModule.registerQueue({ name: QUEUE_PUSH }, { name: QUEUE_EMAIL }, { name: QUEUE_JOBS });

/**
 * Shared by the API and the worker. Global, so feature modules can inject PrismaService, Redis (@InjectRedis()),
 * JwtService, queues (@InjectQueue), EmailService, StorageService and NotificationsService without importing anything.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    PrismaModule,
    // BullMQ needs its own connections with maxRetriesPerRequest: null
    BullModule.forRoot({ connection: { ...appConfig().redis, maxRetriesPerRequest: null } }),
    queues,
    JwtModule.register({
      global: true,
      secret: appConfig().auth.jwt_secret,
      signOptions: { algorithm: 'HS256', expiresIn: 3600 },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  ],
  providers: [redisProvider, HealthService, EmailService, StorageService, NotificationsService],
  exports: [REDIS, queues, HealthService, EmailService, StorageService, NotificationsService],
})
export class CoreModule implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
