import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

export type AuthContext = {
  userId: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
};

// Extract Bearer token from Authorization header (or `?token=` for fallback).
function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  // Fallback for cases where header isn't easy to set (e.g. <a download>)
  const fromQuery = request.nextUrl.searchParams.get('token');
  return fromQuery || null;
}

// Look up the session and return the authenticated user, or null.
// Token is opaque — we never trust client-provided role; we read from User.
export async function getCurrentUser(request: NextRequest): Promise<AuthContext | null> {
  const token = extractToken(request);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true, role: true, email: true, firstName: true, lastName: true,
          isActive: true, deletedAt: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Sweep expired session
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  if (!session.user || !session.user.isActive || session.user.deletedAt) return null;

  return {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
  };
}

// Throw a Response if not authenticated. Use in route handlers:
//   const me = await requireAuth(request); if (me instanceof Response) return me;
export async function requireAuth(request: NextRequest): Promise<AuthContext | Response> {
  const me = await getCurrentUser(request);
  if (!me) {
    return Response.json({ error: 'Unauthorized — sign in required' }, { status: 401 });
  }
  return me;
}

// Throw a Response if not authenticated OR not in the allowed roles.
export async function requireRole(
  request: NextRequest,
  allowed: Role[],
): Promise<AuthContext | Response> {
  const me = await getCurrentUser(request);
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed.includes(me.role)) {
    return Response.json({ error: 'Forbidden — your role cannot perform this action' }, { status: 403 });
  }
  return me;
}

// Simple in-memory rate limiter. For multi-instance prod use Upstash instead.
// Map<key, { count, resetAt }>
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true };
}

// Best-effort IP extraction (Vercel: x-forwarded-for, dev: localhost)
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
