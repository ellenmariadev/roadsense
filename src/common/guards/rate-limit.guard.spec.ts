import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

function contextFor(ip: string): ExecutionContext {
  const response = { setHeader: jest.fn() };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: {} }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function guardWithLimit(max: number): RateLimitGuard {
  return new RateLimitGuard({
    get: (key: string, defaultValue: number) =>
      key === 'rateLimit.max' ? max : key === 'rateLimit.windowMs' ? 60_000 : defaultValue,
  } as ConfigService);
}

describe('RateLimitGuard', () => {
  it('allows requests up to the configured limit and rejects the next one', () => {
    const guard = guardWithLimit(2);
    expect(guard.canActivate(contextFor('127.0.0.1'))).toBe(true);
    expect(guard.canActivate(contextFor('127.0.0.1'))).toBe(true);
    expect(() => guard.canActivate(contextFor('127.0.0.1'))).toThrow(HttpException);

    try {
      guard.canActivate(contextFor('127.0.0.1'));
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('tracks clients independently', () => {
    const guard = guardWithLimit(1);
    expect(guard.canActivate(contextFor('127.0.0.1'))).toBe(true);
    expect(guard.canActivate(contextFor('127.0.0.2'))).toBe(true);
  });

  it('resets the window after it expires', () => {
    jest.useFakeTimers();
    const guard = guardWithLimit(1);
    expect(guard.canActivate(contextFor('127.0.0.1'))).toBe(true);
    expect(() => guard.canActivate(contextFor('127.0.0.1'))).toThrow(HttpException);
    jest.advanceTimersByTime(60_001);
    expect(guard.canActivate(contextFor('127.0.0.1'))).toBe(true);
    jest.useRealTimers();
  });
});
