import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import appConfig from '../config/app.config';
import { PrismaClient } from '../../prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = appConfig().database.url;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    // pg pool: DB_POOL_MAX connections per instance (keep instances × max under Postgres max_connections);
    // fail fast when the pool is exhausted instead of hanging a request.
    super({
      adapter: new PrismaPg({
        connectionString,
        max: Number(process.env.DB_POOL_MAX) || 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
