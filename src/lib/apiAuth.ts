import { getAuthFromRequest, type TokenPayload } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { PermissionScope } from '@/lib/permissions';

type AuthSuccess = TokenPayload;
type AuthResult = AuthSuccess | Response;
type ScopedAuth = TokenPayload & { permissions: string[] };
type ScopedResult = ScopedAuth | Response;

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

/**
 * Require a valid auth token AND a specific permission scope.
 * - ADMIN bypasses scope checks (has access to everything).
 * - STAFF must have the scope in their User.permissions array.
 * - Other roles (TEACHER, PARENT, STUDENT) are denied — they have their own portals.
 *
 * Returns auth context including permissions on success, or 401/403 on failure.
 *
 * Usage:
 *   const auth = await requireScope(request, 'fees');
 *   if (auth instanceof Response) return auth;
 */
export async function requireScope(
  request: Request,
  scope: PermissionScope,
): Promise<ScopedResult> {
  const payload = getAuthFromRequest(request);
  if (!payload) {
    return Response.json(
      { error: 'Unauthorized — valid token required' },
      { status: 401 }
    );
  }
  // ADMIN gets everything
  if (payload.role === 'ADMIN') {
    return { ...payload, permissions: [] };
  }
  // Only STAFF role uses fine-grained permissions on the admin side
  if (payload.role !== 'STAFF') {
    return Response.json(
      { error: `Forbidden — '${scope}' requires admin or staff with that permission` },
      { status: 403 }
    );
  }
  // Look up current permissions from DB (token doesn't carry them — keeps revocation immediate)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { permissions: true, isActive: true } as any,
  });
  if (!user || !(user as any).isActive) {
    return Response.json({ error: 'Account not found or deactivated' }, { status: 401 });
  }
  const permissions = ((user as any).permissions || []) as string[];
  if (!permissions.includes(scope)) {
    return Response.json(
      { error: `Forbidden — missing '${scope}' permission. Ask an admin to grant access.` },
      { status: 403 }
    );
  }
  return { ...payload, permissions };
}

/**
 * Require any one of multiple scopes (OR semantics).
 * Useful for routes that serve multiple features (e.g. a search endpoint
 * accessible from both Students and Admission).
 */
export async function requireAnyScope(
  request: Request,
  scopes: PermissionScope[],
): Promise<ScopedResult> {
  const payload = getAuthFromRequest(request);
  if (!payload) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (payload.role === 'ADMIN') return { ...payload, permissions: [] };
  if (payload.role !== 'STAFF') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { permissions: true, isActive: true } as any,
  });
  if (!user || !(user as any).isActive) {
    return Response.json({ error: 'Account deactivated' }, { status: 401 });
  }
  const granted = new Set((user as any).permissions || []);
  const ok = scopes.some(s => granted.has(s));
  if (!ok) {
    return Response.json(
      { error: `Forbidden — requires one of: ${scopes.join(', ')}` },
      { status: 403 }
    );
  }
  return { ...payload, permissions: Array.from(granted) as string[] };
}
