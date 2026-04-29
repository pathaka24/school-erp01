import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

function generatePassword() {
  // 12-char alphanumeric, easy to read aloud (no 0/O/1/l/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { password: providedPassword } = body as { password?: string };

  const password = providedPassword?.trim() || generatePassword();
  if (password.length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return Response.json({ user, password, generated: !providedPassword });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    return Response.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
