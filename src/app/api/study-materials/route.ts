import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/study-materials?classId=&subjectId=&teacherId=&studentId=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const subjectId = searchParams.get('subjectId');
  const teacherId = searchParams.get('teacherId');
  const studentId = searchParams.get('studentId');

  let resolvedClassId = classId;
  if (studentId && !classId) {
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
    if (s) resolvedClassId = s.classId;
  }

  const where: any = {};
  if (resolvedClassId) where.classId = resolvedClassId;
  if (subjectId) where.subjectId = subjectId;
  if (teacherId) where.teacherId = teacherId;

  const materials = await prisma.studyMaterial.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(materials);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, classId, subjectId, teacherId, type, url, fileName, fileSize } = body;

  if (!title || !classId || !subjectId || !teacherId || !url) {
    return Response.json({ error: 'title, classId, subjectId, teacherId, url are required' }, { status: 400 });
  }

  const material = await prisma.studyMaterial.create({
    data: {
      title,
      description: description || null,
      classId, subjectId, teacherId,
      type: type || 'LINK',
      url,
      fileName: fileName || null,
      fileSize: fileSize ? Number(fileSize) : null,
    },
  });
  return Response.json(material, { status: 201 });
}
