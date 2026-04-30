import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { pushToUsers } from '@/lib/push';

// GET /api/messages/threads/[id]?userId= — fetch full thread + messages, mark messages read
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId');

  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });
  if (!thread) return Response.json({ error: 'Thread not found' }, { status: 404 });

  // Mark unread messages as read
  if (userId) {
    const otherMessages = thread.messages.filter(m => m.senderId !== userId);
    if (otherMessages.length > 0) {
      await Promise.all(
        otherMessages.map(m =>
          prisma.messageRead.upsert({
            where: { messageId_userId: { messageId: m.id, userId } },
            update: {},
            create: { messageId: m.id, userId },
          })
        )
      );
    }
  }

  return Response.json(thread);
}

// POST /api/messages/threads/[id] — append a message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = await params;
  const { senderId, body } = await request.json();
  if (!senderId || !body) return Response.json({ error: 'senderId and body are required' }, { status: 400 });

  // Verify sender is a participant
  const participant = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId: senderId } },
  });
  if (!participant) return Response.json({ error: 'Sender is not a participant in this thread' }, { status: 403 });

  const message = await prisma.message.create({
    data: { threadId, senderId, body },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  // Bump thread updatedAt
  await prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Push to other participants (best-effort)
  (async () => {
    try {
      const others = await prisma.threadParticipant.findMany({
        where: { threadId, userId: { not: senderId } },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (others.length === 0) return;
      const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, lastName: true } });
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';
      await pushToUsers(others.map(o => o.userId), {
        title: senderName,
        body: body.slice(0, 140),
        data: { type: 'message', threadId },
      });
    } catch (e) {
      console.warn('[message] push failed', e);
    }
  })();

  return Response.json(message, { status: 201 });
}
