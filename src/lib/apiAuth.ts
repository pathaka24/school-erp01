import { getAuthFromRequest, type TokenPayload } from '@/lib/auth';

type AuthSuccess = TokenPayload;
type AuthResult = AuthSuccess | Response;

/**
 * Require a valid auth token on the request.
 * Returns the token payload on success, or a 401 Response on failure.
 *
 * Usage in a route handler:
 *   const auth = requireAuth(request);
 *   if (auth instanceof Response) return auth;
 *   // auth is now { userId, role }
 */
export function requireAuth(request: Request): AuthResult {
  const payload = getAuthFromRequest(request);
  if (!payload) {
    return Response.json(
      { error: 'Unauthorized — valid token required' },
      { status: 401 }
    );
  }
  return payload;
}

/**
 * Require a valid auth token AND one of the allowed roles.
 * Returns the token payload on success, or a 401/403 Response on failure.
 *
 * Usage in a route handler:
 *   const auth = requireRole(request, ['ADMIN', 'TEACHER']);
 *   if (auth instanceof Response) return auth;
 *   // auth is now { userId, role }
 */
export function requireRole(request: Request, roles: string[]): AuthResult {
  const payload = getAuthFromRequest(request);
  if (!payload) {
    return Response.json(
      { error: 'Unauthorized — valid token required' },
      { status: 401 }
    );
  }
  if (!roles.includes(payload.role)) {
    return Response.json(
      { error: 'Forbidden — insufficient permissions' },
      { status: 403 }
    );
  }
  return payload;
}
