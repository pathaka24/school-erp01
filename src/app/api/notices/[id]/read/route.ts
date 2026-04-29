import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/notices/[id]/read — mark notice as read for the user
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: noticeId } = await params;
  const { userId } = await request.json();
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

  await prisma.noticeRead.upsert({
    where: { noticeId_userId: { noticeId, userId } },
    update: {},
    create: { noticeId, userId },
  });
  return Response.json({ message: 'Marked read' });
}
