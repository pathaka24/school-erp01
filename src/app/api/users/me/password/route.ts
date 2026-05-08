import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/apiAuth';

// POST /api/users/me/password
// Body: { currentPassword, newPassword }
// Self-service password change. Requires the current password.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 401 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return Response.json({ ok: true });
}
