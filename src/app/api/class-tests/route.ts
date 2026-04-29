import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/class-tests?teacherId=&classId=&sectionId=&subjectId=&studentId=
// Lists class tests with optional filters. studentId returns tests for the student's section
// (only tests where the student has marks recorded OR tests in their section/class).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const teacherId = searchParams.get('teacherId');
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const subjectId = searchParams.get('subjectId');
  const studentId = searchParams.get('studentId');

  const where: any = {};
  if (teacherId) where.teacherId = teacherId;
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (subjectId) where.subjectId = subjectId;

  if (studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { sectionId: true, classId: true },
    });
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
    where.sectionId = student.sectionId;
  }

  const tests = await prisma.classTest.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      syllabusTopic: { select: { id: true, name: true, chapter: true } },
      ...(studentId
        ? { marks: { where: { studentId }, select: { id: true, marksObtained: true, remarks: true } } }
        : { _count: { select: { marks: true } } }),
    },
    orderBy: { date: 'desc' },
  });

  return Response.json(tests);
}

// POST /api/class-tests — create a new class test
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacherId, classId, sectionId, subjectId, syllabusTopicId, name, description, date, maxMarks } = body;

  if (!teacherId || !classId || !sectionId || !subjectId || !name || !date || !maxMarks) {
    return Response.json(
      { error: 'teacherId, classId, sectionId, subjectId, name, date, and maxMarks are required' },
      { status: 400 }
    );
  }

  const test = await prisma.classTest.create({
    data: {
      teacherId,
      classId,
      sectionId,
      subjectId,
      syllabusTopicId: syllabusTopicId || null,
      name,
      description: description || null,
      date: new Date(date),
      maxMarks: Number(maxMarks),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      syllabusTopic: { select: { id: true, name: true, chapter: true } },
    },
  });
  return Response.json(test, { status: 201 });
}
