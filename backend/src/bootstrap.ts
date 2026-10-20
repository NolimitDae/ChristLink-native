import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import appConfig from './config/app.config';
import { HealthService } from './health/health.service';

/** Everything main.ts applies to the API app. The e2e tests call it too, so they test the real setup. */
export function configureApi(app: NestExpressApplication) {
  // Railway's proxy: req.ip is the real client IP (rate limits key on it)
  app.set('trust proxy', 1);
  // Data-URL uploads (5 MB images) arrive as JSON, like server.js
  app.useBodyParser('json', { limit: '15mb' });

  // POST /webhook (Stripe, raw body in req.rawBody) stays at the root like server.js
  app.setGlobalPrefix('api', { exclude: [{ path: 'webhook', method: RequestMethod.POST }] });
  // GET /health at the root like server.js; HealthController serves /api/health (Railway healthcheck)
  const health = app.get(HealthService);
  app.getHttpAdapter().get('/health', async (_req: Request, res: Response) => {
    const { status, body } = await health.report();
    res.status(status).json(body);
  });

  // The website's address, plus any extra ones in CORS_ORIGINS (comma-separated).
  // The native app sends no Origin header, so CORS doesn't affect it.
  const { client_app_url, cors_origins } = appConfig().app;
  const origins = [client_app_url, ...cors_origins].map((o) => o?.trim().replace(/\/+$/, '')).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, maxAge: 86400 });

  app.use(helmet());
  // DTO classes are validated and stripped of unknown fields. Routes that accept server.js's loose bodies type
  // @Body() with a plain interface instead: the pipe skips those and the service validates by hand.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  return app;
}
