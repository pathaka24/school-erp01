import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/syllabus?classId=&subjectId=&academicYear=
// Lists syllabi (optionally filtered). When all three filters are set, returns at most one.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const subjectId = searchParams.get('subjectId');
  const academicYear = searchParams.get('academicYear');

  const where: any = {};
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;
  if (academicYear) where.academicYear = academicYear;

  const syllabi = await prisma.syllabus.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      topics: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const enriched = syllabi.map(s => {
    const total = s.topics.length;
    const completed = s.topics.filter(t => t.status === 'COMPLETED').length;
    const inProgress = s.topics.filter(t => t.status === 'IN_PROGRESS').length;
    const coveragePct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...s, totalTopics: total, completedTopics: completed, inProgressTopics: inProgress, coveragePct };
  });

  return Response.json(enriched);
}

// POST /api/syllabus
// Creates an empty syllabus container; topics added via /api/syllabus/[id]/topics
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { classId, subjectId, academicYear } = body;

  if (!classId || !subjectId || !academicYear) {
    return Response.json({ error: 'classId, subjectId, and academicYear are required' }, { status: 400 });
  }

  try {
    const syllabus = await prisma.syllabus.create({
      data: { classId, subjectId, academicYear },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        topics: true,
      },
    });
    return Response.json(syllabus, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'A syllabus already exists for this class, subject and academic year' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create syllabus' }, { status: 500 });
  }
}
