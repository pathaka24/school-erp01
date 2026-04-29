import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const syllabus = await prisma.syllabus.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      topics: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!syllabus) return Response.json({ error: 'Syllabus not found' }, { status: 404 });
  return Response.json(syllabus);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.syllabus.delete({ where: { id } });
    return Response.json({ message: 'Syllabus deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Syllabus not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete syllabus' }, { status: 500 });
  }
}
