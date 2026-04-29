import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// PUT /api/syllabus/topics/[id] — update a single topic
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { chapter, name, description, expectedDate, status, completedDate, order } = body;

  const data: any = {};
  if (chapter !== undefined) data.chapter = chapter || null;
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (expectedDate !== undefined) data.expectedDate = expectedDate ? new Date(expectedDate) : null;
  if (order !== undefined) data.order = order;
  if (status !== undefined) {
    data.status = status;
    if (status === 'COMPLETED') {
      data.completedDate = completedDate ? new Date(completedDate) : new Date();
    } else if (status !== 'COMPLETED') {
      data.completedDate = null;
    }
  } else if (completedDate !== undefined) {
    data.completedDate = completedDate ? new Date(completedDate) : null;
  }

  try {
    const topic = await prisma.syllabusTopic.update({ where: { id }, data });
    return Response.json(topic);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Topic not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.syllabusTopic.delete({ where: { id } });
    return Response.json({ message: 'Topic deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Topic not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}
