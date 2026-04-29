import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/syllabus/[id]/topics — add a topic to a syllabus
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: syllabusId } = await params;
  const body = await request.json();
  const { chapter, name, description, expectedDate, status, order } = body;

  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  // Verify syllabus exists
  const syllabus = await prisma.syllabus.findUnique({ where: { id: syllabusId }, select: { id: true } });
  if (!syllabus) return Response.json({ error: 'Syllabus not found' }, { status: 404 });

  // Default order = max + 1
  let finalOrder = order;
  if (finalOrder === undefined || finalOrder === null) {
    const last = await prisma.syllabusTopic.findFirst({
      where: { syllabusId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    finalOrder = (last?.order ?? -1) + 1;
  }

  const topic = await prisma.syllabusTopic.create({
    data: {
      syllabusId,
      chapter: chapter || null,
      name,
      description: description || null,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      status: status || 'PENDING',
      order: finalOrder,
    },
  });
  return Response.json(topic, { status: 201 });
}
