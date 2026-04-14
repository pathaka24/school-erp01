import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { class: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 });
  return Response.json(subject);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, code, teacherId } = await request.json();
  const subject = await prisma.subject.update({
    where: { id },
    data: { name, code, teacherId },
    include: { class: { select: { id: true, name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  return Response.json(subject);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.subject.delete({ where: { id } });
  return Response.json({ message: 'Subject deleted' });
}
