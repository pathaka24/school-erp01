import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await prisma.classTest.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      syllabusTopic: { select: { id: true, name: true, chapter: true } },
      marks: {
        include: {
          student: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!test) return Response.json({ error: 'Class test not found' }, { status: 404 });
  return Response.json(test);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, description, date, maxMarks, syllabusTopicId } = body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (date !== undefined) data.date = new Date(date);
  if (maxMarks !== undefined) data.maxMarks = Number(maxMarks);
  if (syllabusTopicId !== undefined) data.syllabusTopicId = syllabusTopicId || null;

  try {
    const test = await prisma.classTest.update({ where: { id }, data });
    return Response.json(test);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Class test not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update class test' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.classTest.delete({ where: { id } });
    return Response.json({ message: 'Class test deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Class test not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete class test' }, { status: 500 });
  }
}
