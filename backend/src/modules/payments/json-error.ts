import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * An error whose JSON body has more than `error` (server.js sends e.g. `{ valid: false, error }` or
 * `{ error, resetCard: true }`). The global filter would reduce it to `{ error }`, so the payments controllers
 * use JsonErrorFilter, which sends the body as is.
 */
export class JsonError extends HttpException {
  constructor(status: number, readonly body: Record<string, unknown>) {
    super(String(body.error ?? 'Error'), status);
  }
}

@Catch(JsonError)
export class JsonErrorFilter implements ExceptionFilter {
  catch(exception: JsonError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(exception.getStatus()).json(exception.body);
  }
}

/** Stripe errors become 400 with Stripe's message (like server.js); anything else stays a generic 500. */
export function stripeError(e: unknown): never {
  if (e instanceof HttpException) throw e;
  const err = e as { type?: string; message?: string };
  if (err?.type?.startsWith('Stripe')) throw new JsonError(400, { error: err.message });
  throw e;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Supabase answered a malformed id with "not found"; Prisma would throw, so check first. */
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
