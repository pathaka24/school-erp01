import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/auth/change-password
// Body: { userId, currentPassword, newPassword }
export async function POST(request: NextRequest) {
  const { userId, currentPassword, newPassword } = await request.json();

  if (!userId || !currentPassword || !newPassword) {
    return Response.json({ error: 'userId, currentPassword and newPassword are required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 401 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return Response.json({ ok: true });
}
