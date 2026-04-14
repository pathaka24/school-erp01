import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId');
  const where: any = {};
  if (classId) where.classId = classId;

  const exams = await prisma.exam.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      examSubjects: { include: { subject: { select: { name: true, code: true } } } },
    },
    orderBy: { startDate: 'desc' },
  });
  return Response.json(exams);
}

export async function POST(request: NextRequest) {
  const { name, type, classId, startDate, endDate, subjects } = await request.json();
  const exam = await prisma.exam.create({
    data: {
      name, type, classId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      examSubjects: subjects?.length
        ? { createMany: { data: subjects.map((s: any) => ({ subjectId: s.subjectId, date: new Date(s.date), maxMarks: s.maxMarks, passingMarks: s.passingMarks })) } }
        : undefined,
    },
    include: { examSubjects: { include: { subject: true } } },
  });
  return Response.json(exam, { status: 201 });
}
