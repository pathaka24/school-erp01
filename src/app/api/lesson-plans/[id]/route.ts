import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.lessonPlan.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!plan) return Response.json({ error: 'Lesson plan not found' }, { status: 404 });
  return Response.json(plan);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { topic, objectives, content, homework, resources, status, date } = body;

  try {
    const plan = await prisma.lessonPlan.update({
      where: { id },
      data: {
        ...(topic !== undefined && { topic }),
        ...(objectives !== undefined && { objectives }),
        ...(content !== undefined && { content }),
        ...(homework !== undefined && { homework }),
        ...(resources !== undefined && { resources }),
        ...(status !== undefined && { status }),
        ...(date !== undefined && { date: new Date(date) }),
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });
    return Response.json(plan);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Lesson plan not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update lesson plan' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.lessonPlan.delete({ where: { id } });
    return Response.json({ message: 'Lesson plan deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Lesson plan not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete lesson plan' }, { status: 500 });
  }
}
