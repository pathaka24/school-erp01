import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/push/register
// Body: { userId, token, platform? }
// Idempotent: re-register with same token is a no-op (just updates updatedAt)
export async function POST(request: NextRequest) {
  const { userId, token, platform } = await request.json();
  if (!userId || !token) {
    return Response.json({ error: 'userId and token required' }, { status: 400 });
  }

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform: platform || null },
    create: { userId, token, platform: platform || null },
  });

  return Response.json({ ok: true });
}
