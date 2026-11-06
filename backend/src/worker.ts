import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'http';
import { CoreModule } from './core.module';
import { HealthService } from './health/health.service';
import { EmailProcessor } from './worker/email.processor';
import { JobsProcessor } from './worker/jobs.processor';
import { PushProcessor } from './worker/push.processor';

@Module({
  imports: [CoreModule],
  providers: [PushProcessor, EmailProcessor, JobsProcessor],
})
export class WorkerModule {}

/**
 * ROLE=worker: BullMQ processors in a Nest application context (no API routes), plus a tiny HTTP server that
 * answers /health and /api/health so Railway's shared healthcheck passes.
 */
export async function startWorker(port: number) {
  const ctx = await NestFactory.createApplicationContext(WorkerModule);
  ctx.enableShutdownHooks();
  const health = ctx.get(HealthService);

  const server = createServer(async (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
      const { status, body } = await health.report();
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Not found.' }));
  });
  server.listen(port, '0.0.0.0');
  process.once('SIGTERM', () => server.close());
  new Logger('Worker').log(`Worker running; health on :${port}`);
  return ctx;
}
