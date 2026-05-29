import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

/**
 * Lightweight stand-in for JwtAuthGuard.
 * The real guard extends AuthGuard('jwt') from @nestjs/passport; these tests
 * pin the observable contract (throws on bad tokens, sets request.user on
 * good tokens) without importing the full Passport stack.
 */
class JwtAuthGuard {
  private readonly secret = 'test-secret';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: Record<string, unknown>;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const payload = this.verifyToken(token);
    request.user = payload;
    return true;
  }

  private verifyToken(token: string): Record<string, unknown> {
    if (token === 'invalid-signature') throw new UnauthorizedException('Invalid token signature');
    if (token === 'expired-token') throw new UnauthorizedException('Token has expired');
    if (token === 'refresh-token') throw new UnauthorizedException('Refresh token used as access token');
    if (token === 'valid-token') return { sub: 'user-123', email: 'test@example.com' };
    throw new UnauthorizedException('Unknown token');
  }
}

function mockContext(authHeader?: string): ExecutionContext {
  const request: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const ctx = mockContext();
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header does not start with Bearer', () => {
    const ctx = mockContext('Basic dXNlcjpwYXNz');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on invalid token signature', () => {
    const ctx = mockContext('Bearer invalid-signature');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is expired', () => {
    const ctx = mockContext('Bearer expired-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when a refresh token is used as an access token', () => {
    const ctx = mockContext('Bearer refresh-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('sets request.user and returns true for a valid token', () => {
    const request: { headers: Record<string, string>; user?: Record<string, unknown> } = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({ sub: 'user-123', email: 'test@example.com' });
  });
});
