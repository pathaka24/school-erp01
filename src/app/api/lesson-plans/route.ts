import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const teacherId = searchParams.get('teacherId');
  const classId = searchParams.get('classId');
  const subjectId = searchParams.get('subjectId');
  const status = searchParams.get('status');

  const where: any = {};
  if (teacherId) where.teacherId = teacherId;
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;
  if (status) where.status = status;

  const plans = await prisma.lessonPlan.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { date: 'desc' },
  });
  return Response.json(plans);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacherId, classId, sectionId, subjectId, date, topic, objectives, content, homework, resources } = body;

  if (!teacherId || !classId || !sectionId || !subjectId || !date || !topic) {
    return Response.json({ error: 'Teacher, class, section, subject, date, and topic are required' }, { status: 400 });
  }

  const plan = await prisma.lessonPlan.create({
    data: {
      teacherId, classId, sectionId, subjectId,
      date: new Date(date),
      topic, objectives, content, homework, resources,
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });
  return Response.json(plan, { status: 201 });
}
