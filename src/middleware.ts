import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth-edge';

// Public endpoints that bypass auth (login itself + one-shot seed routes for demo)
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/seed',
  '/api/seed-parent',
  '/api/seed-demo',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow CORS preflight through
  if (request.method === 'OPTIONS') return NextResponse.next();

  // Allow public endpoints
  if (PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: 'Invalid Authorization format' }, { status: 401 });
  }

  const payload = await verifyTokenEdge(match[1]);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Forward identity to route handlers via headers
  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.userId);
  headers.set('x-user-role', payload.role);

  return NextResponse.next({ request: { headers } });
}

// Protect /api/* only — UI is gated client-side by AuthGuard
export const config = {
  matcher: '/api/:path*',
};
