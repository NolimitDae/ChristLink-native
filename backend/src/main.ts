import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import appConfig from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');

  // The website's address, plus any extra ones in CORS_ORIGINS (comma-separated).
  // The native app sends no Origin header, so CORS doesn't affect it.
  const origins = [appConfig().app.client_app_url, ...(process.env.CORS_ORIGINS ?? '').split(',')]
    .map((o) => o?.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, maxAge: 86400 });

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
bootstrap();
