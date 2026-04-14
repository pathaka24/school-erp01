import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId');
  const where: any = {};
  if (classId) where.classId = classId;

  const subjects = await prisma.subject.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  return Response.json(subjects);
}

export async function POST(request: NextRequest) {
  const { name, code, classId, teacherId } = await request.json();
  try {
    const subject = await prisma.subject.create({
      data: { name, code, classId, teacherId },
      include: { class: { select: { id: true, name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    return Response.json(subject, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Subject code already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}
