import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const date = searchParams.get('date');

  const where: any = {};
  if (date) where.date = new Date(date);
  if (classId || sectionId) {
    where.student = {};
    if (classId) where.student.classId = classId;
    if (sectionId) where.student.sectionId = sectionId;
  }

  const attendance = await prisma.attendance.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: { student: { user: { firstName: 'asc' } } },
  });
  return Response.json(attendance);
}
