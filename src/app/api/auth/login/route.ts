import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { loginSchema, validate } from '@/lib/validations';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const v = validate(loginSchema, body);
  if ('error' in v) return v.error;
  const { email, password } = v.data;

  // Rate limit by IP and by email separately, whichever trips first.
  // 10 attempts per IP per 5 min, 5 attempts per email per 15 min.
  const ip = clientIp(request);
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 5 * 60 * 1000);
  if (!ipLimit.ok) {
    return Response.json(
      { error: `Too many login attempts. Try again in ${ipLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
    );
  }
  const emailLimit = rateLimit(`login:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
  if (!emailLimit.ok) {
    return Response.json(
      { error: `Too many failed attempts for this account. Try again in ${emailLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (!user.isActive) {
    return Response.json({ error: 'Account is deactivated' }, { status: 403 });
  }

  // Soft-deleted users (added in this session) can't log in either
  if ((user as any).deletedAt) {
    return Response.json({ error: 'Account is deactivated' }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // HMAC-SHA256 signed token (no JWT dependency needed)
  const token = signToken({ userId: user.id, role: user.role });

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      permissions: (user as any).permissions || [],
    },
    token,
  });
}
