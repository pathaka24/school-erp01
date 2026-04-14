import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await request.json();

  if (!password || password.length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: teacher.userId }, data: { passwordHash } });

  return Response.json({ message: 'Password reset successfully' });
}
