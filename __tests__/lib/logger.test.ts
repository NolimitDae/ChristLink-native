/* eslint-disable no-console */
import { logger } from '../../lib/logger';

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls console.log for info level', () => {
    logger.info('test message');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect((console.log as jest.Mock).mock.calls[0][0]).toContain('test message');
    expect((console.log as jest.Mock).mock.calls[0][0]).toContain('INFO');
  });

  it('calls console.warn for warn level', () => {
    logger.warn('warning');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain('WARN');
  });

  it('calls console.error for error level', () => {
    logger.error('failure', { code: 500 });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect((console.error as jest.Mock).mock.calls[0][0]).toContain('ERROR');
    expect((console.error as jest.Mock).mock.calls[0][0]).toContain('failure');
  });

  it('includes context as JSON in output', () => {
    logger.info('ctx test', { userId: 'abc123' });
    const output = (console.log as jest.Mock).mock.calls[0][0] as string;
    expect(output).toContain('abc123');
  });

  it('includes timestamp in output', () => {
    logger.info('ts test');
    const output = (console.log as jest.Mock).mock.calls[0][0] as string;
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
