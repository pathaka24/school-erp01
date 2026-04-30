import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher-daily-log/today?teacherId=  → today's entry, null if not yet written
export async function GET(request: NextRequest) {
  const teacherId = request.nextUrl.searchParams.get('teacherId');
  if (!teacherId) return Response.json({ error: 'teacherId required' }, { status: 400 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const log = await prisma.teacherDailyLog.findUnique({
    where: { teacherId_date: { teacherId, date: today } },
  });
  return Response.json(log);
}
