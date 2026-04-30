import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher-daily-log?teacherId=&from=&to=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const teacherId = searchParams.get('teacherId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: any = {};
  if (teacherId) where.teacherId = teacherId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const logs = await prisma.teacherDailyLog.findMany({
    where,
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { date: 'desc' },
  });
  return Response.json(logs);
}

// POST /api/teacher-daily-log — create or update today's entry (upsert)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacherId, date, summary, periodsTaught, highlights, concerns, tomorrowPlan, mood, signature } = body;

  if (!teacherId || !date) {
    return Response.json({ error: 'teacherId and date are required' }, { status: 400 });
  }

  const log = await prisma.teacherDailyLog.upsert({
    where: { teacherId_date: { teacherId, date: new Date(date) } },
    update: {
      summary: summary || null,
      periodsTaught: periodsTaught != null ? Number(periodsTaught) : null,
      highlights: highlights || null,
      concerns: concerns || null,
      tomorrowPlan: tomorrowPlan || null,
      mood: mood || null,
      signature: signature || null,
    },
    create: {
      teacherId,
      date: new Date(date),
      summary: summary || null,
      periodsTaught: periodsTaught != null ? Number(periodsTaught) : null,
      highlights: highlights || null,
      concerns: concerns || null,
      tomorrowPlan: tomorrowPlan || null,
      mood: mood || null,
      signature: signature || null,
    },
  });
  return Response.json(log, { status: 201 });
}
