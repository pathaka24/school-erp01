import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/reminders?studentId=  — reminder history for a student
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;
  const studentId = request.nextUrl.searchParams.get('studentId');
  if (!studentId) return Response.json({ error: 'studentId is required' }, { status: 400 });
  const reminders = await prisma.feeReminder.findMany({
    where: { studentId },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });
  return Response.json({ reminders });
}

// POST /api/fees/reminders
// Body: { studentIds: string[] | studentId, channel: 'WHATSAPP'|'LETTER'|'NOTICE'|'CALL', note?, message? }
// Logs a reminder per student. For channel NOTICE, also posts an in-app message
// to each student's linked parent (shows in the parent portal).
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : (body.studentId ? [body.studentId] : []);
  const channel = ['WHATSAPP', 'LETTER', 'NOTICE', 'CALL'].includes(body.channel) ? body.channel : 'NOTICE';
  if (studentIds.length === 0) return Response.json({ error: 'studentIds is required' }, { status: 400 });

  // Outstanding at reminder time (latest balance per student)
  const latest = await prisma.feeLedger.findMany({
    where: { studentId: { in: studentIds }, voidedAt: null, archivedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    distinct: ['studentId'],
    select: { studentId: true, balanceAfter: true },
  });
  const balMap = new Map(latest.map(e => [e.studentId, e.balanceAfter]));

  await prisma.feeReminder.createMany({
    data: studentIds.map(sid => ({
      studentId: sid, channel,
      amount: Math.max(0, balMap.get(sid) || 0),
      note: body.note || null,
      sentBy: `${auth.userId}`,
    })),
  });

  // Targeted in-app message to the parent for the NOTICE channel
  let messaged = 0;
  if (channel === 'NOTICE') {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, user: { select: { firstName: true, lastName: true } }, parent: { select: { userId: true } } },
    });
    for (const s of students) {
      const parentUserId = s.parent?.userId;
      if (!parentUserId || !auth.userId) continue;
      const bal = Math.max(0, balMap.get(s.id) || 0);
      const msg = body.message
        || `Dear Parent, this is a reminder that ₹${Math.round(bal).toLocaleString('en-IN')} in fees is pending for ${s.user.firstName} ${s.user.lastName}. Kindly clear the dues at your earliest convenience. Thank you.`;
      try {
        await prisma.messageThread.create({
          data: {
            subject: 'Fee Reminder',
            studentId: s.id,
            participants: { create: [{ userId: auth.userId }, { userId: parentUserId }] },
            messages: { create: [{ senderId: auth.userId, body: msg }] },
          },
        });
        messaged++;
      } catch { /* parent may be self-linked or missing — skip */ }
    }
  }

  return Response.json({ logged: studentIds.length, messaged });
}
