import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { loginSchema, validate } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const v = validate(loginSchema, body);
  if ('error' in v) return v.error;
  const { email, password } = v.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (!user.isActive) {
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
    },
    token,
  });
}
