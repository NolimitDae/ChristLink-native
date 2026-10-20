import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApi } from './bootstrap';
import appConfig from './config/app.config';
import { startWorker } from './worker';

// Both Railway services run `node dist/src/main`; the worker service sets ROLE=worker.
async function bootstrap() {
  const { role, port } = appConfig().app;
  if (role === 'worker') return startWorker(port);

  // A short or literal placeholder secret would let anyone forge sign-in tokens
  const secret = appConfig().auth.jwt_secret ?? '';
  if (secret.length < 32 || secret.includes('${{')) throw new Error('JWT_SECRET must be a random string of at least 32 characters');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApi(app);
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}
bootstrap();
