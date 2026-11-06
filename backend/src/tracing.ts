/**
 * OpenTelemetry tracing, loaded before anything else in main.ts so http/express/pg/ioredis get instrumented.
 * Off unless an OTLP endpoint is configured — Railway sets the OTEL_EXPORTER_OTLP_* variables when tracing is
 * enabled for the service — so local runs and tests pay nothing. Each request becomes a trace with its SQL queries,
 * Redis calls and outgoing HTTP (Stripe, Resend, Expo push) as child spans, which is how slow requests are found.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

export function tracingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true';
}

if (tracingEnabled()) {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || `christlink-${process.env.ROLE === 'worker' ? 'worker' : 'api'}`,
    instrumentations: [
      // Health checks every few seconds would drown the real traffic
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => /\/health$/.test(req.url ?? '') }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });
  sdk.start();
  const stop = () => sdk.shutdown().catch(() => undefined);
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
