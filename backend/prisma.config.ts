// Prisma configuration file
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    // Only needed locally for `prisma migrate diff --from-migrations` / `migrate dev`
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
