import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teachers/[id]/diary?from=&to=
// Admin view: lesson plans + class tests created by a teacher in the date range, grouped by date.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: teacherId } = await params;
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const to = toParam ? new Date(toParam) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      employeeId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const [lessonPlans, classTests, dailyLogs] = await Promise.all([
    prisma.lessonPlan.findMany({
      where: { teacherId, date: { gte: from, lte: to } },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.classTest.findMany({
      where: { teacherId, date: { gte: from, lte: to } },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        syllabusTopic: { select: { id: true, name: true, chapter: true } },
        _count: { select: { marks: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.teacherDailyLog.findMany({
      where: { teacherId, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    }),
  ]);

  type DayBucket = {
    date: string;
    lessons: typeof lessonPlans;
    tests: typeof classTests;
    dailyLog: typeof dailyLogs[number] | null;
  };
  const byDate = new Map<string, DayBucket>();
  const ensure = (d: Date): DayBucket => {
    const key = d.toISOString().slice(0, 10);
    let b = byDate.get(key);
    if (!b) { b = { date: key, lessons: [], tests: [], dailyLog: null }; byDate.set(key, b); }
    return b;
  };
  for (const lp of lessonPlans) ensure(new Date(lp.date)).lessons.push(lp);
  for (const ct of classTests) ensure(new Date(ct.date)).tests.push(ct);
  for (const dl of dailyLogs) ensure(new Date(dl.date)).dailyLog = dl;
  const days = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));

  return Response.json({
    teacher: {
      id: teacher.id,
      employeeId: teacher.employeeId,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
    },
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    days,
    counts: {
      lessons: lessonPlans.length,
      tests: classTests.length,
      days: days.length,
      completedLessons: lessonPlans.filter(l => l.status === 'COMPLETED').length,
      dailyLogs: dailyLogs.length,
    },
  });
}
