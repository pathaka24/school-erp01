import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/parent/daily-diary/[studentId]?from=&to=
// Returns date-grouped lesson plans for the student's section, plus class tests in the same window.
export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Default window: last 30 days
  const to = toParam ? new Date(toParam) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      sectionId: true,
      classId: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const [lessonPlans, classTests] = await Promise.all([
    prisma.lessonPlan.findMany({
      where: {
        sectionId: student.sectionId,
        date: { gte: from, lte: to },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.classTest.findMany({
      where: {
        sectionId: student.sectionId,
        date: { gte: from, lte: to },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        marks: { where: { studentId }, select: { marksObtained: true, remarks: true } },
        syllabusTopic: { select: { id: true, name: true, chapter: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ]);

  // Group by ISO date
  type DayBucket = {
    date: string;
    lessons: typeof lessonPlans;
    tests: typeof classTests;
  };
  const byDate = new Map<string, DayBucket>();

  const ensure = (d: Date): DayBucket => {
    const key = d.toISOString().slice(0, 10);
    let bucket = byDate.get(key);
    if (!bucket) {
      bucket = { date: key, lessons: [], tests: [] };
      byDate.set(key, bucket);
    }
    return bucket;
  };

  for (const lp of lessonPlans) ensure(new Date(lp.date)).lessons.push(lp);
  for (const ct of classTests) ensure(new Date(ct.date)).tests.push(ct);

  const days = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));

  return Response.json({
    student: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      className: student.class.name,
      sectionName: student.section.name,
    },
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    days,
    counts: {
      lessons: lessonPlans.length,
      tests: classTests.length,
      days: days.length,
    },
  });
}
