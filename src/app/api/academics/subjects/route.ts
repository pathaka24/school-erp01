import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { name, code, classId, teacherId } = await request.json();

  if (!name) return Response.json({ error: 'Subject name required' }, { status: 400 });

  // Generate code if not provided
  const subCode = code || name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) + (classId ? classId.slice(0, 4) : '');

  // Check if subject with same name exists for this class
  if (classId) {
    const existing = await prisma.subject.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, classId },
    });
    if (existing) return Response.json(existing);
  }

  try {
    const subject = await prisma.subject.create({
      data: {
        name,
        code: subCode,
        classId: classId || undefined,
        teacherId: teacherId || undefined,
      },
    });
    return Response.json(subject, { status: 201 });
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Code already exists, try with random suffix
      const subject = await prisma.subject.create({
        data: {
          name,
          code: subCode + Math.random().toString(36).slice(2, 5).toUpperCase(),
          classId: classId || undefined,
          teacherId: teacherId || undefined,
        },
      });
      return Response.json(subject, { status: 201 });
    }
    return Response.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}
