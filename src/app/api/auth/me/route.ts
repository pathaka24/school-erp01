import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, avatar: true, isActive: true },
  });

  if (!user || !user.isActive) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({ user });
}
