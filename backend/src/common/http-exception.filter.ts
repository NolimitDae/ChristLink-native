import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

/** Every error leaves as `{ "error": "message" }`, like server.js. Unexpected errors are logged, never echoed. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const { status, error } = toErrorBody(exception);
    if (status >= 500) {
      const req = host.switchToHttp().getRequest();
      this.logger.error(`${req?.method} ${req?.url}: ${(exception as Error)?.stack ?? exception}`);
    }
    res.status(status).json({ error });
  }
}

export function toErrorBody(exception: unknown): { status: number; error: string } {
  if (exception instanceof ThrottlerException) {
    return { status: HttpStatus.TOO_MANY_REQUESTS, error: 'Too many requests.' };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    let message: unknown = typeof body === 'string' ? body : (body as { message?: unknown })?.message;
    // ValidationPipe sends an array of messages
    if (Array.isArray(message)) message = message.join('. ');
    if (status >= 500) return { status, error: 'Something went wrong. Please try again.' };
    return { status, error: typeof message === 'string' && message ? message : exception.message };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, error: 'Something went wrong. Please try again.' };
}
