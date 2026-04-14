import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const teacherId = searchParams.get('teacherId');

  const where: any = {};
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (teacherId) where.teacherId = teacherId;

  const slots = await prisma.timetable.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return Response.json(slots);
}

export async function POST(request: NextRequest) {
  const { classId, sectionId, subjectId, teacherId, dayOfWeek, startTime, endTime, room } = await request.json();
  const slot = await prisma.timetable.create({
    data: { classId, sectionId, subjectId, teacherId, dayOfWeek, startTime, endTime, room },
    include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  return Response.json(slot, { status: 201 });
}
