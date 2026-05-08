import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher/me/timetable?userId=...
// Returns the calling teacher's full week timetable: every period grouped by day.
// Caller is identified by ?userId query param (set client-side from the auth store).
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true, employeeId: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const slots = await prisma.timetable.findMany({
    where: { teacherId: teacher.id },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return Response.json({
    teacher: {
      id: teacher.id,
      employeeId: teacher.employeeId,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`.trim(),
    },
    slots: slots.map(s => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      class: s.class,
      section: s.section,
      subject: s.subject,
    })),
    totalPeriods: slots.length,
  });
}
