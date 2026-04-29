import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/messages/threads?userId= — list threads where user is participant
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } },
          reads: { where: { userId } },
        },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return Response.json(
    threads.map((t: any) => ({
      ...t,
      lastMessage: t.messages[0] || null,
      unreadLast: t.messages[0] ? t.messages[0].senderId !== userId && t.messages[0].reads.length === 0 : false,
      messages: undefined,
    }))
  );
}

// POST /api/messages/threads — create a thread
// Body: { subject, studentId?, participantIds: [userId, ...] (must include creator), initialMessage?, senderId }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { subject, studentId, participantIds, initialMessage, senderId } = body;

  if (!subject || !Array.isArray(participantIds) || participantIds.length < 2) {
    return Response.json({ error: 'subject and at least 2 participantIds are required' }, { status: 400 });
  }

  const thread = await prisma.messageThread.create({
    data: {
      subject,
      studentId: studentId || null,
      participants: {
        create: participantIds.map((userId: string) => ({ userId })),
      },
      ...(initialMessage && senderId
        ? { messages: { create: [{ senderId, body: initialMessage }] } }
        : {}),
    },
    include: {
      participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      messages: true,
    },
  });
  return Response.json(thread, { status: 201 });
}
