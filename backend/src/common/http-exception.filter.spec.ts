import { BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpExceptionFilter, toErrorBody } from './http-exception.filter';

describe('toErrorBody', () => {
  it('keeps the message and status of HTTP errors', () => {
    expect(toErrorBody(new ForbiddenException('Admin access required.'))).toEqual({ status: 403, error: 'Admin access required.' });
    expect(toErrorBody(new NotFoundException())).toEqual({ status: 404, error: 'Not Found' });
  });

  it('joins validation messages into one string', () => {
    const e = new BadRequestException(['email must be an email', 'token should not be empty']);
    expect(toErrorBody(e)).toEqual({ status: 400, error: 'email must be an email. token should not be empty' });
  });

  it('maps throttling to 429 like server.js', () => {
    expect(toErrorBody(new ThrottlerException())).toEqual({ status: 429, error: 'Too many requests.' });
  });

  it('never leaks internal error text', () => {
    expect(toErrorBody(new Error('password=hunter2 connection refused'))).toEqual({
      status: 500,
      error: 'Something went wrong. Please try again.',
    });
    expect(toErrorBody(new InternalServerErrorException('db secret')).error).toBe('Something went wrong. Please try again.');
  });

  it('writes { error } to the response', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({}) }) };
    new HttpExceptionFilter().catch(new BadRequestException('Email is required.'), host as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Email is required.' });
  });
});
