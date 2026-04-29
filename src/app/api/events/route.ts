import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/events?from=&to=&role=&classId=&sectionId=&studentId=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const role = searchParams.get('role');
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const studentId = searchParams.get('studentId');

  let resolvedClassId = classId;
  let resolvedSectionId = sectionId;
  if (studentId && !classId) {
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true, sectionId: true } });
    if (s) { resolvedClassId = s.classId; resolvedSectionId = s.sectionId; }
  }

  const audienceFilter: any[] = [{ audience: 'ALL' }];
  if (role === 'ADMIN') audienceFilter.push({ audience: 'ADMINS' });
  if (role === 'TEACHER') audienceFilter.push({ audience: 'TEACHERS' });
  if (role === 'PARENT') audienceFilter.push({ audience: 'PARENTS' });
  if (role === 'STUDENT') audienceFilter.push({ audience: 'STUDENTS' });
  if (resolvedClassId) audienceFilter.push({ audience: 'CLASS', classId: resolvedClassId });
  if (resolvedSectionId) audienceFilter.push({ audience: 'SECTION', sectionId: resolvedSectionId });

  const where: any = { OR: audienceFilter };
  if (fromParam || toParam) {
    where.AND = [];
    if (fromParam) where.AND.push({ endDate: { gte: new Date(fromParam) } });
    if (toParam) where.AND.push({ startDate: { lte: new Date(toParam) } });
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'asc' },
  });
  return Response.json(events);
}

// POST /api/events
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, startDate, endDate, startTime, endTime, type, audience, classId, sectionId, location, color, createdById } = body;
  if (!title || !startDate || !endDate || !createdById) {
    return Response.json({ error: 'title, startDate, endDate, createdById are required' }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description: description || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startTime: startTime || null,
      endTime: endTime || null,
      type: type || 'EVENT',
      audience: audience || 'ALL',
      classId: classId || null,
      sectionId: sectionId || null,
      location: location || null,
      color: color || null,
      createdById,
    },
  });
  return Response.json(event, { status: 201 });
}
